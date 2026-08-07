import type { Track } from "@blindtest/core";
import type { SpotifyClient } from "@blindtest/spotify";

export async function collectCandidateTracks(
  spotify: SpotifyClient,
  seedArtists: readonly string[],
  perArtistLimit: number,
): Promise<Track[]> {
  const candidates: Track[] = [];
  for (const artist of seedArtists) {
    const results = await spotify.searchTracksByArtist(artist, perArtistLimit);
    candidates.push(...results);
  }
  return candidates;
}
