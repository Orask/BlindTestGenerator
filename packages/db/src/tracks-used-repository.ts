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

/** Tracks used at or after `sinceDate` — the hard-exclude set for a reuse cooldown. */
export function getUsedTrackIdsSince(
  db: Database.Database,
  channelId: string,
  sinceDate: Date,
): Set<string> {
  const rows = db
    .prepare<[string, string], { spotify_track_id: string }>(
      "SELECT spotify_track_id FROM tracks_used WHERE channel_id = ? AND used_at >= ?",
    )
    .all(channelId, sinceDate.toISOString());
  return new Set(rows.map((row) => row.spotify_track_id));
}

export interface RecentTrack {
  readonly title: string;
  readonly artist: string;
}

/** Title+artist of every track used for a theme since `sinceDate` — context for the AI episode review (see apps/pipeline/src/review-episode.ts) to flag artists over-repeated across recent weeks. */
export function getRecentTracksForTheme(
  db: Database.Database,
  themeId: string,
  sinceDate: Date,
): RecentTrack[] {
  return db
    .prepare<[string, string], RecentTrack>(
      "SELECT title, artist FROM tracks_used WHERE theme_id = ? AND used_at >= ? ORDER BY used_at DESC",
    )
    .all(themeId, sinceDate.toISOString());
}

export interface UsedTrack {
  readonly spotifyTrackId: string;
  readonly title: string;
  readonly artist: string;
}

/**
 * Every distinct track this channel has ever used, across every theme and
 * episode — the candidate pool for Short types that mine the channel's own
 * history (e.g. "top tracks of an artist we've featured", "anniversary of
 * a track's release", see apps/pipeline/src/shorts/) rather than a single
 * episode's tracks_used rows. Small enough in practice (low hundreds of
 * rows) to filter client-side (by artist name, release date, ...) instead
 * of adding a query per filter shape.
 */
export function getUsedTracksForChannel(db: Database.Database, channelId: string): UsedTrack[] {
  return db
    .prepare<[string], { spotify_track_id: string; title: string; artist: string }>(
      "SELECT DISTINCT spotify_track_id, title, artist FROM tracks_used WHERE channel_id = ?",
    )
    .all(channelId)
    .map((row) => ({
      spotifyTrackId: row.spotify_track_id,
      title: row.title,
      artist: row.artist,
    }));
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
