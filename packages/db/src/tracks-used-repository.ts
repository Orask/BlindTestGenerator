import type Database from "better-sqlite3";

export interface RecordTrackUsageParams {
  readonly channelId: string;
  readonly themeId: string;
  readonly spotifyTrackId: string;
  readonly title: string;
  readonly artist: string;
  readonly videoId: string | null;
  readonly usedAt: Date;
}

export function getUsedTrackIds(db: Database.Database, channelId: string): Set<string> {
  const rows = db
    .prepare<[string], { spotify_track_id: string }>(
      "SELECT spotify_track_id FROM tracks_used WHERE channel_id = ?",
    )
    .all(channelId);
  return new Set(rows.map((row) => row.spotify_track_id));
}

export function recordTrackUsage(db: Database.Database, params: RecordTrackUsageParams): void {
  db.prepare(
    `INSERT INTO tracks_used (channel_id, theme_id, spotify_track_id, title, artist, used_at, video_id)
     VALUES (@channelId, @themeId, @spotifyTrackId, @title, @artist, @usedAt, @videoId)`,
  ).run({
    channelId: params.channelId,
    themeId: params.themeId,
    spotifyTrackId: params.spotifyTrackId,
    title: params.title,
    artist: params.artist,
    usedAt: params.usedAt.toISOString(),
    videoId: params.videoId,
  });
}
