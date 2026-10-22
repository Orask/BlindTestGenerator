import type Database from "better-sqlite3";

export type SpotifyResolutionStatus = "resolved" | "not_found" | "rejected_version";

export function recordSpotifyResolution(
  db: Database.Database,
  cacheKey: string,
  status: SpotifyResolutionStatus,
  spotifyTrackId: string | null,
  now: Date = new Date(),
): void {
  db.prepare(
    `INSERT INTO spotify_resolution_cache (cache_key, status, spotify_track_id, checked_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (cache_key) DO UPDATE SET
       status = excluded.status,
       spotify_track_id = excluded.spotify_track_id,
       checked_at = excluded.checked_at`,
  ).run(cacheKey, status, spotifyTrackId, now.toISOString());
}
