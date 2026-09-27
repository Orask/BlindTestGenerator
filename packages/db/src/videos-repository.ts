import type Database from "better-sqlite3";

export type VideoStatus = "draft" | "uploaded" | "failed";
export type VideoFormat = "long" | "short";

export interface CreateVideoParams {
  readonly id: string;
  readonly channelId: string;
  readonly themeId: string;
  readonly createdAt: Date;
  readonly filePath: string;
  readonly visibility: string;
  readonly format: VideoFormat;
}

export function createVideo(db: Database.Database, params: CreateVideoParams): void {
  db.prepare(
    `INSERT INTO videos (id, channel_id, theme_id, created_at, file_path, youtube_video_id, status, visibility, format)
     VALUES (@id, @channelId, @themeId, @createdAt, @filePath, NULL, 'draft', @visibility, @format)`,
  ).run({
    id: params.id,
    channelId: params.channelId,
    themeId: params.themeId,
    createdAt: params.createdAt.toISOString(),
    filePath: params.filePath,
    visibility: params.visibility,
    format: params.format,
  });
}

export function markVideoUploaded(
  db: Database.Database,
  videoId: string,
  youtubeVideoId: string,
): void {
  db.prepare("UPDATE videos SET status = 'uploaded', youtube_video_id = ? WHERE id = ?").run(
    youtubeVideoId,
    videoId,
  );
}

export function markVideoFailed(db: Database.Database, videoId: string): void {
  db.prepare("UPDATE videos SET status = 'failed' WHERE id = ?").run(videoId);
}

/** Used to number episodes in the video title (e.g. "Ép. 12"). */
export function countVideosForTheme(db: Database.Database, themeId: string): number {
  const row = db
    .prepare<[string], { count: number }>("SELECT COUNT(*) AS count FROM videos WHERE theme_id = ?")
    .get(themeId);
  return row?.count ?? 0;
}

/**
 * Whether this theme already has a successfully published video for the
 * same UTC calendar day as `referenceDate` — used to make a daily run
 * idempotent when it can be triggered more than once for the same day (the
 * native GitHub Actions `schedule` trigger plus an external trigger set up
 * to work around its imprecise firing time, or a manual re-run after an
 * already-successful one). Only `status = 'uploaded'` counts: a `draft` or
 * `failed` row means the previous attempt never actually published, so a
 * retry must still be allowed to go through.
 */
export function hasUploadedVideoForThemeToday(
  db: Database.Database,
  channelId: string,
  themeId: string,
  referenceDate: Date,
): boolean {
  const row = db
    .prepare<[string, string, string], { found: number }>(
      `SELECT 1 AS found FROM videos
       WHERE channel_id = ? AND theme_id = ? AND status = 'uploaded'
         AND date(created_at) = date(?)
       LIMIT 1`,
    )
    .get(channelId, themeId, referenceDate.toISOString());
  return row !== undefined;
}
