import type { ItunesClient, ItunesPreviewResult } from "./types.js";

interface RawItunesTrack {
  readonly trackName: string;
  readonly artistName: string;
  readonly previewUrl?: string;
  readonly wrapperType?: string;
  readonly kind?: string;
}

interface ItunesSearchResponse {
  readonly resultCount: number;
  readonly results: readonly RawItunesTrack[];
}

const COMBINING_DIACRITICS = /[\u0300-\u036f]/g;

// iTunes Search returns an intermittent, apparently random 403 (observed
// live: the exact same query flips between 200 and 403 across repeated
// calls seconds apart, roughly half the time — not correlated with query
// content or our own request volume, likely a degraded edge node in
// Apple's pool). A short, capped backoff with several attempts is cheap
// and brings the odds of exhausting retries on any one lookup down to a
// fraction of a percent.
const RATE_LIMIT_STATUSES = new Set([403, 429]);
const MAX_ATTEMPTS = 8;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 4000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Unlike Deezer's field-scoped search, iTunes does a loose full-text match
// and always returns *something* — so a plausibility check on the result is
// required, not optional, to avoid pairing a track with the wrong preview.
function isPlausibleMatch(candidate: RawItunesTrack, title: string, artist: string): boolean {
  const candidateTitle = normalize(candidate.trackName);
  const candidateArtist = normalize(candidate.artistName);
  const wantedTitle = normalize(title);
  const wantedArtist = normalize(artist);

  const titleMatches = candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle);
  const artistMatches =
    candidateArtist.includes(wantedArtist) || wantedArtist.includes(candidateArtist);

  return titleMatches && artistMatches;
}

export function createItunesClient(fetchImpl: typeof fetch = fetch): ItunesClient {
  return {
    async findPreviewByTitleAndArtist(
      title: string,
      artist: string,
    ): Promise<ItunesPreviewResult | null> {
      const term = `${artist} ${title}`;
      const params = new URLSearchParams({ term, entity: "song", limit: "5" });
      const url = `https://itunes.apple.com/search?${params.toString()}`;

      let lastError: Error | undefined;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const response = await fetchImpl(url);

        if (response.ok) {
          const body = (await response.json()) as ItunesSearchResponse;
          const match = body.results.find((track) => isPlausibleMatch(track, title, artist));
          if (!match || !match.previewUrl) {
            return null;
          }
          return { previewUrl: match.previewUrl };
        }

        if (RATE_LIMIT_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
          await sleep(Math.min(BASE_RETRY_DELAY_MS * attempt, MAX_RETRY_DELAY_MS));
          continue;
        }

        lastError = new Error(
          `iTunes search failed for "${artist} - ${title}": ${response.status} ${await response.text()}`,
        );
        break;
      }

      throw (
        lastError ?? new Error(`iTunes search failed for "${artist} - ${title}": exhausted retries`)
      );
    },
  };
}
