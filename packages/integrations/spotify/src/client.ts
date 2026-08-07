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

export function createSpotifyClient(
  tokenProvider: TokenProvider,
  fetchImpl: typeof fetch = fetch,
): SpotifyClient {
  return {
    async searchTracksByArtist(artistName: string, limit: number): Promise<SpotifyTrackMetadata[]> {
      const accessToken = await tokenProvider.getAccessToken();
      const query = encodeURIComponent(`artist:"${artistName}"`);
      const apiLimit = Math.min(limit, MAX_SEARCH_LIMIT);
      const response = await fetchImpl(
        `https://api.spotify.com/v1/search?q=${query}&type=track&limit=${apiLimit}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );

      if (!response.ok) {
        throw new Error(
          `Spotify search failed for artist "${artistName}": ${response.status} ${await response.text()}`,
        );
      }

      const data = (await response.json()) as { tracks: { items: RawSpotifyTrack[] } };
      const seenTitles = new Set<string>();
      const results: SpotifyTrackMetadata[] = [];

      for (const track of data.tracks.items) {
        if (NON_ORIGINAL_VERSION_PATTERN.test(track.name)) {
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
          albumCoverUrl: track.album.images[0]?.url ?? "",
        });

        if (results.length === limit) {
          break;
        }
      }

      return results;
    },
  };
}
