import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { hydrateShortTrack } from "./hydrate-track.js";
import type { ShortCandidateTrack } from "./types.js";

/**
 * Family A, type 1: the original Short type (see docs/CLOUD_SESSION_LOG.md
 * — first prototyped 2026-09-27). Cuts a mini blind-test from an
 * already-published episode's *opening* tracks — cheap to pick since
 * buildOpeningHook (build-episode-tracks.ts) already reordered that
 * episode so its first few tracks are its strongest, most recognizable
 * draws; this just borrows that ordering, it doesn't pick anything new.
 */
export async function selectDevineLaChansonTracks(
  db: Database.Database,
  spotify: SpotifyClient,
  itunes: ItunesClient,
  longVideoRowId: string,
  count: number,
  lookupDelayMs?: number,
): Promise<ShortCandidateTrack[]> {
  const trackRows = db
    .prepare(
      "SELECT spotify_track_id, title, artist FROM tracks_used WHERE video_id = ? ORDER BY rowid LIMIT ?",
    )
    .all(longVideoRowId, count) as {
    spotify_track_id: string;
    title: string;
    artist: string;
  }[];

  const tracks: ShortCandidateTrack[] = [];
  for (const row of trackRows) {
    const metadata = await spotify.getTrackById(row.spotify_track_id);
    const hydrated = await hydrateShortTrack(
      itunes,
      row.title,
      row.artist,
      metadata.albumCoverUrl,
      lookupDelayMs,
    );
    if (hydrated) {
      tracks.push(hydrated);
    }
  }
  return tracks;
}
