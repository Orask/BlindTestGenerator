import type { AnthropicClient } from "@blindtest/anthropic";
import type { SpotifyClient } from "@blindtest/spotify";

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(name: string): string {
  return name.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

const SEARCH_PAGE_SIZE = 10;
const MAX_SEARCH_PAGES = 3;

// Confirmed live (2026-10-12): "Années 80 Forever" and "Le meilleur des
// années 80" both passed the old live-verification check below and got
// persisted into seedArtists — a compilation curator has real tracks
// attributed to it on Spotify, so searchTracksByArtist alone doesn't
// catch it, contrary to what this function used to assume. This pattern
// rejects the common French/English compilation-naming shapes before
// spending an API call on them at all.
const COMPILATION_NAME_PATTERN =
  /\b(forever|compilation|compil|tubes?( des?)?|hits?( des?)?|meilleur(e|s)?( des?)?|best of|greatest hits|le meilleur|ultimate|s[ée]lection|party mix|megamix)\b/i;

function looksLikeCompilation(name: string): boolean {
  return COMPILATION_NAME_PATTERN.test(name);
}

// Confirmed live (2026-10-22): "has at least 1 track on Spotify" lets
// through genuinely obscure names (Theodora, marguerite, Jeck, Helena,
// Lisa Pariente — all real Spotify artists, none recognizable enough for
// a mainstream blind test) just as easily as it lets through real finds —
// recall this session's discovery fallback resurfacing the exact same
// junk names on separate themes. When an AnthropicClient is available,
// over-collect this many times maxNew's worth of live-verified candidates
// so a notoriety pass (see filterByNotoriety) still has enough left after
// rejecting the obscure ones.
const OVERCOLLECT_FACTOR = 3;

interface RawNotorietyResponse {
  readonly known?: unknown;
}

function isValidCandidateIndex(value: unknown, total: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= total;
}

const NOTORIETY_SYSTEM_PROMPT =
  "Tu juges si des noms d'artistes sont suffisamment connus du grand public français " +
  "pour une chaîne YouTube de blind test musical.";

function buildNotorietyPrompt(candidates: readonly string[], discoveryQuery: string): string {
  const lines = candidates.map((name, index) => `${index + 1}. ${name}`).join("\n");
  return `Thème/genre de la chaîne : "${discoveryQuery}"

Voici une liste de noms d'artistes, trouvés par une recherche automatique sur Spotify dans ce genre et déjà confirmés comme ayant au moins un morceau référencé. Certains sont des artistes grand public bien connus ; d'autres sont des artistes obscurs qui ont bien un morceau sur Spotify sans être réellement reconnus du grand public.

${lines}

Pour chaque numéro, indique si cet artiste est suffisamment connu du grand public français pour qu'un spectateur moyen reconnaisse probablement au moins un de ses morceaux dans un blind test. Sois strict : en cas de doute sérieux, considère l'artiste comme pas assez connu plutôt que de prendre le risque.

Réponds UNIQUEMENT avec un JSON valide (rien avant, rien après, pas de \`\`\`json\`\`\` autour), exactement dans ce format :
{
  "known": [numéros des artistes suffisamment connus, ex: [1, 3, 7]]
}`;
}

/**
 * Rejects every candidate (rather than trusting them all) on any failure
 * to get a clean, parseable judgment — the opposite fail-direction from
 * reviewEpisode.ts's fail-open, and deliberately so: the entire point of
 * this pass is to be MORE conservative than "has 1 Spotify track", so
 * falling back to "trust everything" on an AI hiccup would silently
 * reintroduce the exact bug this exists to fix. Rejecting everything
 * instead costs nothing beyond what already happens today when discovery
 * finds 0 new artists (pipeline.ts's buildTracksWithDiscoveryFallback
 * just re-throws the original InsufficientTracksError) — never worse than
 * the pre-existing baseline.
 */
async function filterByNotoriety(
  anthropic: AnthropicClient,
  candidates: readonly string[],
  discoveryQuery: string,
): Promise<string[]> {
  let raw: string;
  try {
    raw = await anthropic.complete({
      system: NOTORIETY_SYSTEM_PROMPT,
      prompt: buildNotorietyPrompt(candidates, discoveryQuery),
      maxTokens: 1000,
    });
  } catch {
    return [];
  }

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: RawNotorietyResponse;
  try {
    parsed = JSON.parse(cleaned) as RawNotorietyResponse;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.known)) {
    return [];
  }

  const knownIndexes = new Set(
    parsed.known.filter((value): value is number =>
      isValidCandidateIndex(value, candidates.length),
    ),
  );
  return candidates.filter((_, index) => knownIndexes.has(index + 1));
}

/**
 * Finds new artists for a theme when its seedArtists pool runs short,
 * using a free-text artist search (a genre/style phrase like "rap
 * francais") — see SpotifyClient.searchArtists for why this works despite
 * Spotify's other discovery endpoints being locked down for this app tier.
 *
 * Every candidate is also live-verified via searchTracksByArtist, but that
 * alone isn't enough (see OVERCOLLECT_FACTOR's comment) — a name that
 * looks like a compilation/playlist curator is rejected outright, before
 * any API call, and when `anthropic` is supplied, every live-verified
 * survivor additionally has to pass a notoriety judgment call that no
 * metadata API can make. `anthropic` is optional and changes nothing about
 * the function's behavior when omitted — a caller that can't or doesn't
 * want to spend an AI call keeps today's exact behavior.
 */
export async function discoverNewArtists(
  spotify: SpotifyClient,
  discoveryQuery: string,
  existingArtists: readonly string[],
  maxNew: number,
  anthropic?: AnthropicClient,
): Promise<string[]> {
  const known = new Set(existingArtists.map(normalize));
  const seen = new Set<string>();
  const found: string[] = [];
  const collectTarget = anthropic ? maxNew * OVERCOLLECT_FACTOR : maxNew;

  for (let page = 0; page < MAX_SEARCH_PAGES && found.length < collectTarget; page++) {
    const names = await spotify.searchArtists(
      discoveryQuery,
      SEARCH_PAGE_SIZE,
      page * SEARCH_PAGE_SIZE,
    );
    if (names.length === 0) {
      break;
    }

    for (const name of names) {
      if (found.length >= collectTarget) {
        break;
      }
      const key = normalize(name);
      if (known.has(key) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (looksLikeCompilation(name)) {
        continue;
      }

      const verified = await spotify.searchTracksByArtist(name, 1);
      if (verified.length > 0) {
        found.push(name);
        known.add(key);
      }
    }
  }

  if (!anthropic || found.length === 0) {
    return found.slice(0, maxNew);
  }

  const wellKnown = await filterByNotoriety(anthropic, found, discoveryQuery);
  return wellKnown.slice(0, maxNew);
}
