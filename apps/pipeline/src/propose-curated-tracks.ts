import type { AnthropicClient } from "@blindtest/anthropic";
import type { Track } from "@blindtest/core";
import type { SpotifyClient } from "@blindtest/spotify";

interface RawProposalResponse {
  readonly titles?: unknown;
}

const SYSTEM_PROMPT =
  "Tu proposes des titres de morceaux réels et connus pour une chaîne YouTube de blind " +
  "test musical français. Tu ne dois jamais inventer un titre — uniquement citer des " +
  "morceaux qui existent réellement, avec leur titre exact tel qu'ils sont sortis.";

function buildProposalPrompt(
  artist: string,
  themeLabel: string,
  count: number,
  excludeTitles: readonly string[],
): string {
  const exclusionLine =
    excludeTitles.length > 0
      ? `\nNe propose pas ces titres (déjà retenus ou déjà écartés) : ${excludeTitles.map((t) => `"${t}"`).join(", ")}.\n`
      : "";
  return `Thème de la chaîne : "${themeLabel}"
Artiste : "${artist}"

Liste les ${count} morceaux les plus connus et reconnaissables de cet artiste, dans l'esprit de ce thème. Chaque titre doit être exact (orthographe, ponctuation) tel qu'il apparaît sur les plateformes de streaming — ne propose un titre que si tu es vraiment confiant qu'il existe réellement sous ce nom.
${exclusionLine}
Réponds UNIQUEMENT avec un JSON valide (rien avant, rien après, pas de \`\`\`json\`\`\` autour), exactement dans ce format :
{
  "titles": ["Titre exact 1", "Titre exact 2"]
}`;
}

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalizeTitle(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

function parseProposal(raw: string): string[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: RawProposalResponse;
  try {
    parsed = JSON.parse(cleaned) as RawProposalResponse;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.titles)) {
    return [];
  }
  return parsed.titles.filter(
    (title): title is string => typeof title === "string" && title.trim().length > 0,
  );
}

/**
 * Proposes candidate curatedTracks for one artist via an LLM, then trusts
 * none of it blindly: every proposed title still has to resolve through
 * the exact same Spotify exact-match search collectCuratedTracks itself
 * uses (searchTrackByTitleAndArtist) before being returned — a
 * hallucinated or misremembered title just fails that check like any
 * other typo would, same as today. Automates the "research real titles,
 * verify each one before trusting it" loop done by hand throughout
 * 2026-10-22's session to fix multiple thin themes (rap-fr, années-80,
 * années-2000, variété actuelle) — see
 * /Users/lucaslordon/.claude/plans/hazy-stargazing-peach.md, Axe 6.3.
 *
 * Returns the full, *Spotify-canonical* Track (not the AI's proposed
 * spelling, and not just a {title, artist} pair) — this session also
 * found several curatedTracks that failed only because the hand-typed
 * title differed from Spotify's own by punctuation or spelling (e.g.
 * "Pourquoi les hommes ?" vs the real "Pourquoi les hommes?"); trusting
 * the verified match's own title avoids reintroducing that exact bug
 * class, and keeping the full Track (not just title/artist) lets a
 * caller that needs the Spotify id — e.g. populate-catalog.ts's
 * iTunes-preview fallback — use the result directly without a redundant
 * second lookup.
 */
export async function proposeCuratedTracksForArtist(
  anthropic: AnthropicClient,
  spotify: SpotifyClient,
  artist: string,
  themeLabel: string,
  count: number,
  excludeTitles: readonly string[] = [],
): Promise<Track[]> {
  let raw: string;
  try {
    raw = await anthropic.complete({
      system: SYSTEM_PROMPT,
      prompt: buildProposalPrompt(artist, themeLabel, count, excludeTitles),
      maxTokens: 1000,
    });
  } catch {
    return [];
  }

  const excluded = new Set(excludeTitles.map(normalizeTitle));
  const titles = parseProposal(raw).filter((title) => !excluded.has(normalizeTitle(title)));
  const verified: Track[] = [];
  for (const title of titles) {
    const match = await spotify.searchTrackByTitleAndArtist(title, artist);
    // Defensive: the AI was asked not to re-propose an excluded title, but
    // the only hard guarantee here is this post-filter against what
    // Spotify actually resolved it to (e.g. a slightly different
    // proposed spelling that still resolves to the same excluded track).
    if (match && !excluded.has(normalizeTitle(match.title))) {
      verified.push(match);
    }
  }
  return verified;
}
