import type { AnthropicClient } from "@blindtest/anthropic";
import type { SpotifyClient } from "@blindtest/spotify";
import type { CuratedTrackSpec } from "./collect-curated-tracks.js";

interface RawProposalResponse {
  readonly titles?: unknown;
}

const SYSTEM_PROMPT =
  "Tu proposes des titres de morceaux réels et connus pour une chaîne YouTube de blind " +
  "test musical français. Tu ne dois jamais inventer un titre — uniquement citer des " +
  "morceaux qui existent réellement, avec leur titre exact tel qu'ils sont sortis.";

function buildProposalPrompt(artist: string, themeLabel: string, count: number): string {
  return `Thème de la chaîne : "${themeLabel}"
Artiste : "${artist}"

Liste les ${count} morceaux les plus connus et reconnaissables de cet artiste, dans l'esprit de ce thème. Chaque titre doit être exact (orthographe, ponctuation) tel qu'il apparaît sur les plateformes de streaming — ne propose un titre que si tu es vraiment confiant qu'il existe réellement sous ce nom.

Réponds UNIQUEMENT avec un JSON valide (rien avant, rien après, pas de \`\`\`json\`\`\` autour), exactement dans ce format :
{
  "titles": ["Titre exact 1", "Titre exact 2"]
}`;
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
 * Returns the *Spotify-canonical* title, not the AI's proposed spelling —
 * this session also found several curatedTracks that failed only because
 * the hand-typed title differed from Spotify's own by punctuation or
 * spelling (e.g. "Pourquoi les hommes ?" vs the real "Pourquoi les
 * hommes?"); trusting the verified match's own title avoids reintroducing
 * that exact bug class.
 */
export async function proposeCuratedTracksForArtist(
  anthropic: AnthropicClient,
  spotify: SpotifyClient,
  artist: string,
  themeLabel: string,
  count: number,
): Promise<CuratedTrackSpec[]> {
  let raw: string;
  try {
    raw = await anthropic.complete({
      system: SYSTEM_PROMPT,
      prompt: buildProposalPrompt(artist, themeLabel, count),
      maxTokens: 1000,
    });
  } catch {
    return [];
  }

  const titles = parseProposal(raw);
  const verified: CuratedTrackSpec[] = [];
  for (const title of titles) {
    const match = await spotify.searchTrackByTitleAndArtist(title, artist);
    if (match) {
      verified.push({ title: match.title, artist });
    }
  }
  return verified;
}
