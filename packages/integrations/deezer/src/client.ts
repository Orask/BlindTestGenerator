import type { DeezerClient } from "./types.js";

interface RawDeezerTrack {
  readonly title: string;
  readonly rank: number;
  readonly artist: { readonly name: string };
}

interface DeezerSearchResponse {
  readonly data?: readonly RawDeezerTrack[];
  readonly error?: { readonly message: string; readonly type: string; readonly code: number };
}

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// A plain-text Deezer search returns real noise (remixes, instrumentals,
// covers by tribute acts) that a title/artist match has to filter out
// itself — same reasoning as iTunes' own isPlausibleMatch in
// @blindtest/itunes, whose loose full-text search has the same problem.
function isPlausibleMatch(candidate: RawDeezerTrack, title: string, artist: string): boolean {
  const candidateTitle = normalize(candidate.title);
  const candidateArtist = normalize(candidate.artist.name);
  const wantedTitle = normalize(title);
  const wantedArtist = normalize(artist);

  const titleMatches = candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle);
  const artistMatches =
    candidateArtist.includes(wantedArtist) || wantedArtist.includes(candidateArtist);

  return titleMatches && artistMatches;
}

/**
 * No authentication of any kind — Deezer's catalog endpoints (search,
 * chart, track/album/artist lookup) have never required a key, unlike
 * Spotify's Client Credentials flow.
 *
 * Verified live against the real API (2026-09-28, outside the cloud
 * sandbox that had this host network-blocked): the field-scoped
 * `artist:"X" track:"Y"` query this client originally used (per the
 * deezer-js source it was modeled on) returns zero results for EVERY
 * query tested, including definitely-indexed tracks like Stromae's
 * "Papaoutai" — confirmed the field-scoped operator itself is broken on
 * Deezer's current API, not a quoting/encoding mistake (tried unquoted,
 * differently-encoded, and via both /search and /search/track — all
 * empty). A plain full-text query (`title artist`, no field prefixes)
 * reliably finds the right track; `isPlausibleMatch` below (already
 * needed even for the field-scoped query, since that was never a
 * guaranteed exact match either) does the real narrowing now, so `limit`
 * is raised from 1 to 5 to give it real candidates to filter — a plain
 * query surfaces more noise (remixes, instrumentals, features) than the
 * field-scoped one was supposed to.
 */
export function createDeezerClient(fetchImpl: typeof fetch = fetch): DeezerClient {
  return {
    async getTrackPopularityRank(title: string, artist: string): Promise<number | null> {
      const params = new URLSearchParams({ q: `${title} ${artist}`, order: "RANKING", limit: "5" });
      const url = `https://api.deezer.com/search/track?${params.toString()}`;

      const response = await fetchImpl(url);
      if (!response.ok) {
        throw new Error(`Deezer search failed for "${artist} - ${title}": ${response.status}`);
      }

      const body = (await response.json()) as DeezerSearchResponse;
      if (body.error) {
        throw new Error(`Deezer search failed for "${artist} - ${title}": ${body.error.message}`);
      }

      const match = (body.data ?? []).find((track) => isPlausibleMatch(track, title, artist));
      return match ? match.rank : null;
    },
  };
}
