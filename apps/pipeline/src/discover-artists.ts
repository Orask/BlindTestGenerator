import type { SpotifyClient } from "@blindtest/spotify";

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(name: string): string {
  return name.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

const SEARCH_PAGE_SIZE = 10;
const MAX_SEARCH_PAGES = 3;

/**
 * Finds new artists for a theme when its seedArtists pool runs short,
 * using a free-text artist search (a genre/style phrase like "rap
 * francais") — see SpotifyClient.searchArtists for why this works despite
 * Spotify's other discovery endpoints being locked down for this app tier.
 *
 * Every candidate is live-verified via searchTracksByArtist before being
 * accepted, exactly like a manually-curated seedArtists entry would be:
 * the search also surfaces compilation/pseudo-artist entries (e.g. "Tubes
 * des années 90") and this is what filters those out.
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

      const verified = await spotify.searchTracksByArtist(name, 1);
      if (verified.length > 0) {
        found.push(name);
        known.add(key);
      }
    }
  }

  return found;
}
