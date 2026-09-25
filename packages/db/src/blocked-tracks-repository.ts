import type Database from "better-sqlite3";

export interface BlockTrackParams {
  readonly spotifyTrackId: string;
  readonly title: string;
  readonly artist: string;
  readonly reason: string;
  readonly blockedAt: Date;
}

export function blockTrack(db: Database.Database, params: BlockTrackParams): void {
  db.prepare(
    `INSERT INTO blocked_tracks (spotify_track_id, title, artist, reason, blocked_at)
     VALUES (@spotifyTrackId, @title, @artist, @reason, @blockedAt)
     ON CONFLICT (spotify_track_id) DO UPDATE SET reason = excluded.reason, blocked_at = excluded.blocked_at`,
  ).run({
    spotifyTrackId: params.spotifyTrackId,
    title: params.title,
    artist: params.artist,
    reason: params.reason,
    blockedAt: params.blockedAt.toISOString(),
  });
}

/** Every permanently-blocked track id — the hard-exclude set for candidate selection, same shape as the reuse-cooldown sets. */
export function getBlockedTrackIds(db: Database.Database): Set<string> {
  const rows = db
    .prepare<[], { spotify_track_id: string }>("SELECT spotify_track_id FROM blocked_tracks")
    .all();
  return new Set(rows.map((row) => row.spotify_track_id));
}
