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

/**
 * Finds new artists for a theme when its seedArtists pool runs short,
 * using a free-text artist search (a genre/style phrase like "rap
 * francais") — see SpotifyClient.searchArtists for why this works despite
 * Spotify's other discovery endpoints being locked down for this app tier.
 *
 * Every candidate is also live-verified via searchTracksByArtist, but that
 * alone isn't enough (see looksLikeCompilation's comment) — a name that
 * looks like a compilation/playlist curator is rejected outright, before
 * any API call.
 */
export async function discoverNewArtists(
  spotify: SpotifyClient,
  discoveryQuery: string,
  existingArtists: readonly string[],
  maxNew: number,
): Promise<string[]> {
  const known = new Set(existingArtists.map(normalize));
  const seen = new Set<string>();
  const found: string[] = [];

  for (let page = 0; page < MAX_SEARCH_PAGES && found.length < maxNew; page++) {
    const names = await spotify.searchArtists(
      discoveryQuery,
      SEARCH_PAGE_SIZE,
      page * SEARCH_PAGE_SIZE,
    );
    if (names.length === 0) {
      break;
    }

    for (const name of names) {
      if (found.length >= maxNew) {
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

  return found;
}
