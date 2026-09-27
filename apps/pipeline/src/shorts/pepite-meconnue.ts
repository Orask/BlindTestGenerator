import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { hydrateShortTrack } from "./hydrate-track.js";
import type { ShortCandidateTrack } from "./types.js";

/**
 * Family A, type 2: same episode as "devine la chanson", but the *least*
 * popular tracks instead of the opening hook — a "hidden gem you probably
 * missed" angle instead of "guess the obvious ones". Needs Spotify's real
 * popularity score (see packages/integrations/spotify/src/types.ts —
 * distinct from popularityRank, which is only a search-result rank, not
 * comparable across an episode's ~40-60 different tracks/artists).
 *
 * Cost note: unlike selectDevineLaChansonTracks (which only re-fetches the
 * `count` tracks it actually uses), this has to call getTrackById for
 * *every* track_used row of the episode to know which ones are least
 * popular — one Spotify request per track in the episode (~40-60), not
 * just the ones that end up in the Short. Acceptable for a once-in-a-while
 * Short, but not free; see docs/CLOUD_SESSION_LOG.md for the tradeoff
 * (storing popularity in tracks_used at record time would avoid this
 * re-fetch entirely — a schema change left for later, not done here).
 */
export async function selectPepiteMeconnueTracks(
  db: Database.Database,
  spotify: SpotifyClient,
  itunes: ItunesClient,
  longVideoRowId: string,
  count: number,
  lookupDelayMs?: number,
): Promise<ShortCandidateTrack[]> {
  const trackRows = db
    .prepare(
      "SELECT spotify_track_id, title, artist FROM tracks_used WHERE video_id = ? ORDER BY rowid",
    )
    .all(longVideoRowId) as {
    spotify_track_id: string;
    title: string;
    artist: string;
  }[];

  const withPopularity: { row: (typeof trackRows)[number]; popularity: number; cover: string }[] =
    [];
  for (const row of trackRows) {
    const metadata = await spotify.getTrackById(row.spotify_track_id);
    withPopularity.push({ row, popularity: metadata.popularity, cover: metadata.albumCoverUrl });
  }
  withPopularity.sort((a, b) => a.popularity - b.popularity);

  const tracks: ShortCandidateTrack[] = [];
  for (const { row, cover } of withPopularity) {
    if (tracks.length === count) {
      break;
    }
    const hydrated = await hydrateShortTrack(itunes, row.title, row.artist, cover, lookupDelayMs);
    if (hydrated) {
      tracks.push(hydrated);
    }
  }
  return tracks;
}
