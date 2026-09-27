import type Database from "better-sqlite3";

export interface BlockTrackParams {
  readonly spotifyTrackId: string;
  /** The channel whose video the claim was actually found on — see the comment on blocked_tracks in schema.ts. */
  readonly channelId: string;
  readonly title: string;
  readonly artist: string;
  readonly reason: string;
  readonly blockedAt: Date;
}

export function blockTrack(db: Database.Database, params: BlockTrackParams): void {
  db.prepare(
    `INSERT INTO blocked_tracks (spotify_track_id, channel_id, title, artist, reason, blocked_at)
     VALUES (@spotifyTrackId, @channelId, @title, @artist, @reason, @blockedAt)
     ON CONFLICT (spotify_track_id) DO UPDATE SET reason = excluded.reason, blocked_at = excluded.blocked_at`,
  ).run({
    spotifyTrackId: params.spotifyTrackId,
    channelId: params.channelId,
    title: params.title,
    artist: params.artist,
    reason: params.reason,
    blockedAt: params.blockedAt.toISOString(),
  });
}

/**
 * Every permanently-blocked track id — the hard-exclude set for candidate
 * selection, same shape as the reuse-cooldown sets. Deliberately not scoped
 * by channel (no channelId parameter): a Content ID claim is on the sound
 * recording itself, not on any one channel's use of it, so it stays
 * excluded everywhere even once a second channel exists.
 */
export function getBlockedTrackIds(db: Database.Database): Set<string> {
  const rows = db
    .prepare<[], { spotify_track_id: string }>("SELECT spotify_track_id FROM blocked_tracks")
    .all();
  return new Set(rows.map((row) => row.spotify_track_id));
}
