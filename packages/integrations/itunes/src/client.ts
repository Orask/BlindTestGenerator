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
      const response = await fetchImpl(`https://itunes.apple.com/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error(
          `iTunes search failed for "${artist} - ${title}": ${response.status} ${await response.text()}`,
        );
      }

      const body = (await response.json()) as ItunesSearchResponse;
      const match = body.results.find((track) => isPlausibleMatch(track, title, artist));
      if (!match || !match.previewUrl) {
        return null;
      }

      return { previewUrl: match.previewUrl };
    },
  };
}
