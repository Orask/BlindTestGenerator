import { fetchWithTimeout, type SpotifyFetchInit } from "./fetch-with-timeout.js";
import type { SpotifyClient, SpotifyTrackMetadata } from "./types.js";

export interface TokenProvider {
  getAccessToken(): Promise<string>;
}

interface RawSpotifyTrack {
  readonly id: string;
  readonly name: string;
  readonly artists: readonly { name: string }[];
  readonly album: { images: readonly { url: string }[] };
}

// Spotify no longer exposes recommendations, playlist tracks, or artist
// top-tracks to new apps (see docs/CAHIER_DES_CHARGES.md section 7bis) —
// searching by artist name is what's left, so we filter out non-original
// versions ourselves since the search results mix in remixes/live takes.
const NON_ORIGINAL_VERSION_PATTERN =
  /\b(remix|live|instrumental|edit|version|mix|karaoke|acoustic|remaster(ed)?)\b/i;

// Documented as 50, but new apps get a 400 "Invalid limit" above 10 —
// verified empirically (see docs/CAHIER_DES_CHARGES.md section 3bis).
const MAX_SEARCH_LIMIT = 10;

// searchTracksByArtist pages past MAX_SEARCH_LIMIT via offset when the
// caller wants more than one page's worth — a thin weekly-reuse-cooldown
// squeeze (confirmed live: a theme's whole seed pool falling short even
// after auto-discovery added new artists) is often just an artist's top 10
// being mostly cooldown-locked, not the artist itself being exhausted.
// Bounded like discover-artists.ts's own pagination, for the same reason:
// relevance drops off fast past a few pages, so digging deeper stops paying off.
const MAX_ARTIST_SEARCH_PAGES = 3;

const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

// Shared by artist-name and track-title comparisons - both need the same
// diacritic/case-insensitive exact match to avoid false negatives on accents.
function normalizeForComparison(name: string): string {
  return name.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A sustained burst of requests (e.g. verifying an LLM-curated song list,
// hundreds of calls in one run) can trip Spotify's rate limit even with
// pacing between calls - confirmed live: a 429 "QUOTA_EXCEEDED" partway
// through a ~1200-call verification run, which crashed the whole run and
// lost every result gathered so far. Spotify's 429 response includes a
// `Retry-After` header (seconds to wait); honoring it here means every
// caller gets this resilience for free instead of each one reimplementing
// it, and a transient rate limit degrades to "slower" instead of "crashed".
const MAX_RATE_LIMIT_RETRIES = 5;

// Spotify's `Retry-After` isn't necessarily a short nudge — confirmed live,
// it can be a genuine extended cooldown (minutes+) after a heavy burst.
// Honoring it uncapped turned "rate limited" into "the process silently
// sleeps for however long Spotify feels like, with zero visible activity
// the whole time" — indistinguishable from a hang without added tracing.
// Capping the wait bounds how long a *short* rate limit can stall a run;
// anything longer than the cap is treated as a real cooldown (see
// SpotifyRateLimitedError) and fails immediately instead of retrying.
const MAX_RETRY_AFTER_SECONDS = 30;

// Retries and the pacing above only react *after* Spotify pushes back. A hard
// per-client cap on total HTTP attempts is the proactive half: a run that
// starts looping (bad seed list, discovery fallback spiralling, a retry storm)
// stops itself before it burns the shared quota, instead of finding out from
// a 429 cooldown that then blocks the next scheduled run too. Every attempt
// counts, including retries, since those are exactly what hammers the API.
// Sized for one daily episode (~45 seed artists + discovery fallback) with
// generous headroom; bulk callers (curate-songs-cli) pass their own budget.
export const DEFAULT_MAX_REQUESTS = 300;

export class SpotifyRequestBudgetExceededError extends Error {
  constructor(readonly maxRequests: number) {
    super(
      `Spotify request budget exhausted (${maxRequests} requests) — aborting to protect the API quota`,
    );
    this.name = "SpotifyRequestBudgetExceededError";
  }
}

// A `Retry-After` beyond MAX_RETRY_AFTER_SECONDS means Spotify is in a genuine
// cooldown (confirmed live: QUOTA_EXCEEDED on the very first artist of a
// scheduled run). Sleeping 30s x 5 retries just to fail anyway wastes ~2.5
// minutes and keeps poking the API during the cooldown, which risks
// extending it. Instead the client fails fast and stays "open" (refuses
// every further call without touching the network) until the cooldown
// expires, so one rate-limited call ends the whole run cleanly.
export class SpotifyRateLimitedError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super(
      `Spotify is rate-limited for ~${Math.ceil(retryAfterSeconds)}s — aborting instead of retrying`,
    );
    this.name = "SpotifyRateLimitedError";
  }
}

export interface SpotifyClientOptions {
  /** Max HTTP attempts (retries included) this client may make before refusing further calls. */
  readonly maxRequests?: number;
  /**
   * Epoch ms until which the client should already be considered rate-limited
   * — lets a cooldown discovered by a previous run carry over instead of being
   * rediscovered with fresh requests.
   */
  readonly blockedUntil?: number;
  /** Called once when a long cooldown is detected, so the caller can persist it for the next run. */
  readonly onCooldown?: (blockedUntil: number) => void;
}

interface RequestBudget {
  readonly max: number;
  used: number;
  readonly onCooldown: ((blockedUntil: number) => void) | undefined;
  /** Epoch ms until which the client refuses all calls after a long cooldown; 0 = not blocked. */
  blockedUntil: number;
}

async function fetchWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  init: SpotifyFetchInit,
  budget: RequestBudget,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const isLastAttempt = attempt === MAX_RATE_LIMIT_RETRIES;

    const blockedForMs = budget.blockedUntil - Date.now();
    if (blockedForMs > 0) {
      throw new SpotifyRateLimitedError(blockedForMs / 1000);
    }
    if (budget.used >= budget.max) {
      throw new SpotifyRequestBudgetExceededError(budget.max);
    }
    budget.used++;

    let response: Response;
    try {
      response = await fetchWithTimeout(fetchImpl, url, init);
    } catch (error) {
      // A timed-out/aborted or network-level failure — retried exactly
      // like a 429, since both are transient conditions worth waiting out.
      if (isLastAttempt) {
        throw error;
      }
      await sleep(2 ** attempt * 1000);
      continue;
    }

    // 5xx is Spotify's own infrastructure having a bad moment (confirmed
    // live: a bare 502 "An unexpected error occurred" on the very first
    // artist of an otherwise-healthy run, no rate-limiting involved) — worth
    // a backoff retry same as a network error, just without 429's
    // Retry-After/circuit-breaker semantics, which don't apply here.
    const isRetryableStatus = response.status === 429 || response.status >= 500;
    if (!isRetryableStatus || isLastAttempt) {
      return response;
    }

    if (response.status !== 429) {
      await sleep(2 ** attempt * 1000);
      continue;
    }

    // `retry-after: 0` is a legitimate value that must be respected as-is,
    // not treated as "absent" (which `Number(null) === 0` would do if
    // compared naively) — only a genuinely missing/malformed header falls
    // back to exponential backoff.
    const rawRetryAfter = response.headers.get("retry-after");
    const parsedRetryAfter = rawRetryAfter === null ? NaN : Number(rawRetryAfter);
    const retryAfterSeconds = Number.isNaN(parsedRetryAfter) ? 2 ** attempt : parsedRetryAfter;
    if (retryAfterSeconds > MAX_RETRY_AFTER_SECONDS) {
      budget.blockedUntil = Date.now() + retryAfterSeconds * 1000;
      budget.onCooldown?.(budget.blockedUntil);
      throw new SpotifyRateLimitedError(retryAfterSeconds);
    }
    await sleep(retryAfterSeconds * 1000);
  }
}

export function createSpotifyClient(
  tokenProvider: TokenProvider,
  fetchImpl: typeof fetch = fetch,
  options: SpotifyClientOptions = {},
): SpotifyClient {
  const budget: RequestBudget = {
    max: options.maxRequests ?? DEFAULT_MAX_REQUESTS,
    used: 0,
    onCooldown: options.onCooldown,
    blockedUntil: options.blockedUntil ?? 0,
  };
  return {
    async searchTracksByArtist(artistName: string, limit: number): Promise<SpotifyTrackMetadata[]> {
      const query = encodeURIComponent(`artist:"${artistName}"`);
      const normalizedQuery = normalizeForComparison(artistName);
      const seenTitles = new Set<string>();
      const results: SpotifyTrackMetadata[] = [];

      for (let page = 0; page < MAX_ARTIST_SEARCH_PAGES && results.length < limit; page++) {
        const accessToken = await tokenProvider.getAccessToken();
        const apiLimit = Math.min(limit - results.length, MAX_SEARCH_LIMIT);
        const offset = page * MAX_SEARCH_LIMIT;
        const response = await fetchWithRetry(
          fetchImpl,
          `https://api.spotify.com/v1/search?q=${query}&type=track&limit=${apiLimit}&offset=${offset}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
          budget,
        );

        if (!response.ok) {
          throw new Error(
            `Spotify search failed for artist "${artistName}": ${response.status} ${await response.text()}`,
          );
        }

        const data = (await response.json()) as { tracks: { items: RawSpotifyTrack[] } };

        for (const track of data.tracks.items) {
          if (NON_ORIGINAL_VERSION_PATTERN.test(track.name)) {
            continue;
          }
          // Spotify's `artist:"X"` filter is a loose text match, not an exact
          // one — it happily returns tracks by a completely different artist
          // that merely shares a substring with X (e.g. searching "Dorothée"
          // returns tracks credited only to "Dorothée Pousséo", an unrelated
          // person). Requiring the searched name to exactly match one of the
          // track's own credited artists (diacritic/case-insensitive) is what
          // actually keeps the theme on-topic.
          const isActuallyByArtist = track.artists.some(
            (artist) => normalizeForComparison(artist.name) === normalizedQuery,
          );
          if (!isActuallyByArtist) {
            continue;
          }
          const normalizedTitle = track.name.trim().toLowerCase();
          if (seenTitles.has(normalizedTitle)) {
            continue;
          }
          seenTitles.add(normalizedTitle);

          results.push({
            id: track.id,
            title: track.name,
            artist: track.artists.map((a) => a.name).join(", "),
            artistNames: track.artists.map((a) => a.name),
            albumCoverUrl: track.album.images[0]?.url ?? "",
            popularityRank: results.length,
          });

          if (results.length === limit) {
            break;
          }
        }

        // A partial page means Spotify's index for this query is exhausted —
        // further pages would just repeat or return nothing.
        if (data.tracks.items.length < apiLimit) {
          break;
        }
      }

      return results;
    },

    async searchTrackByTitleAndArtist(
      title: string,
      artistName: string,
    ): Promise<SpotifyTrackMetadata | null> {
      const accessToken = await tokenProvider.getAccessToken();
      const query = encodeURIComponent(`track:"${title}" artist:"${artistName}"`);
      const response = await fetchWithRetry(
        fetchImpl,
        `https://api.spotify.com/v1/search?q=${query}&type=track&limit=${MAX_SEARCH_LIMIT}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        budget,
      );

      if (!response.ok) {
        throw new Error(
          `Spotify title+artist search failed for "${title}" by "${artistName}": ${response.status} ${await response.text()}`,
        );
      }

      const data = (await response.json()) as { tracks: { items: RawSpotifyTrack[] } };
      const normalizedArtist = normalizeForComparison(artistName);
      const normalizedTitle = normalizeForComparison(title);

      for (const track of data.tracks.items) {
        if (NON_ORIGINAL_VERSION_PATTERN.test(track.name)) {
          continue;
        }
        const isActuallyByArtist = track.artists.some(
          (artist) => normalizeForComparison(artist.name) === normalizedArtist,
        );
        if (!isActuallyByArtist) {
          continue;
        }
        // An LLM-supplied title must match exactly (after normalization) —
        // this is the guard against hallucinated or misremembered titles
        // that happen to share an artist with a real track.
        if (normalizeForComparison(track.name) !== normalizedTitle) {
          continue;
        }

        return {
          id: track.id,
          title: track.name,
          artist: track.artists.map((a) => a.name).join(", "),
          artistNames: track.artists.map((a) => a.name),
          albumCoverUrl: track.album.images[0]?.url ?? "",
          popularityRank: 0,
        };
      }

      return null;
    },

    async searchArtists(query: string, limit: number, offset = 0): Promise<string[]> {
      const accessToken = await tokenProvider.getAccessToken();
      const apiLimit = Math.min(limit, MAX_SEARCH_LIMIT);
      const response = await fetchWithRetry(
        fetchImpl,
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=${apiLimit}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        budget,
      );

      if (!response.ok) {
        throw new Error(
          `Spotify artist search failed for query "${query}": ${response.status} ${await response.text()}`,
        );
      }

      const data = (await response.json()) as { artists: { items: { name: string }[] } };
      return data.artists.items.map((artist) => artist.name);
    },

    async getTrackById(id: string): Promise<SpotifyTrackMetadata> {
      const accessToken = await tokenProvider.getAccessToken();
      const response = await fetchWithRetry(
        fetchImpl,
        `https://api.spotify.com/v1/tracks/${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        budget,
      );

      if (!response.ok) {
        throw new Error(
          `Spotify track lookup failed for id "${id}": ${response.status} ${await response.text()}`,
        );
      }

      const track = (await response.json()) as RawSpotifyTrack;
      return {
        id: track.id,
        title: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        artistNames: track.artists.map((a) => a.name),
        albumCoverUrl: track.album.images[0]?.url ?? "",
        popularityRank: 0,
      };
    },
  };
}
