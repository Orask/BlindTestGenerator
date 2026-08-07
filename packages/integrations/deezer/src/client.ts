import type { DeezerClient, DeezerPreviewResult } from "./types.js";

interface RawDeezerTrack {
  readonly title: string;
  readonly artist: { readonly name: string };
  readonly preview: string;
}

interface DeezerSearchResponse {
  readonly data?: readonly RawDeezerTrack[];
  readonly error?: { readonly type: string; readonly message: string; readonly code: number };
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

// Deezer's search relevance is generally good for an exact artist+track query,
// but we double-check the top candidates rather than blindly trusting result
// order, since a wrong preview would silently ruin an episode.
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

export function createDeezerClient(fetchImpl: typeof fetch = fetch): DeezerClient {
  return {
    async findPreviewByTitleAndArtist(
      title: string,
      artist: string,
    ): Promise<DeezerPreviewResult | null> {
      const query = `artist:"${artist}" track:"${title}"`;
      const response = await fetchImpl(
        `https://api.deezer.com/search?q=${encodeURIComponent(query)}`,
      );

      if (!response.ok) {
        throw new Error(
          `Deezer search failed for "${artist} - ${title}": ${response.status} ${await response.text()}`,
        );
      }

      const body = (await response.json()) as DeezerSearchResponse;
      if (body.error) {
        throw new Error(
          `Deezer search returned an error for "${artist} - ${title}": ${body.error.message} (code ${body.error.code})`,
        );
      }

      const match = (body.data ?? []).find((track) => isPlausibleMatch(track, title, artist));
      if (!match || !match.preview) {
        return null;
      }

      return { previewUrl: match.preview };
    },
  };
}
