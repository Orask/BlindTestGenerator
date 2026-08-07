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
