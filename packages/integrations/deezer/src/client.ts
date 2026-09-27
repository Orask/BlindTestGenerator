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

// Deezer's field-scoped search ("artist:... track:...") is already far more
// precise than iTunes' loose full-text match, but it's still not a
// guaranteed exact match (e.g. a cover version by a same-named tribute act)
// — a plausibility check stays cheap insurance, same reasoning as iTunes'
// own isPlausibleMatch in @blindtest/itunes.
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

// Deezer's advanced search syntax wraps each field value in double quotes
// (see docs/CLOUD_SESSION_LOG.md for the deezer-js source this was verified
// against) — a literal quote in a title/artist would otherwise break the
// field boundary.
function escapeForFieldQuery(value: string): string {
  return value.replace(/"/g, "");
}

/**
 * No authentication of any kind — Deezer's catalog endpoints (search,
 * chart, track/album/artist lookup) have never required a key, unlike
 * Spotify's Client Credentials flow. Never verified against a live response
 * in this sandbox (api.deezer.com is blocked by this environment's network
 * policy, same as api.spotify.com — see docs/CLOUD_SESSION_LOG.md); written
 * against the real request/response shapes used by the deezer-js npm
 * package's production code, not just documentation prose. Needs a real
 * end-to-end check before relying on it in production.
 */
export function createDeezerClient(fetchImpl: typeof fetch = fetch): DeezerClient {
  return {
    async getTrackPopularityRank(title: string, artist: string): Promise<number | null> {
      const query = `artist:"${escapeForFieldQuery(artist)}" track:"${escapeForFieldQuery(title)}"`;
      const params = new URLSearchParams({ q: query, order: "RANKING", limit: "1" });
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
