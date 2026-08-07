import type Database from "better-sqlite3";

export interface ChannelRow {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly visibility: string;
}

export interface ChannelThemeRow {
  readonly id: string;
  readonly channelId: string;
  readonly day: string;
  readonly label: string;
}

export function upsertChannel(db: Database.Database, channel: ChannelRow): void {
  db.prepare(
    `INSERT INTO channels (id, name, language, visibility)
     VALUES (@id, @name, @language, @visibility)
     ON CONFLICT (id) DO UPDATE SET name = @name, language = @language, visibility = @visibility`,
  ).run(channel);
}

export function upsertChannelTheme(db: Database.Database, theme: ChannelThemeRow): void {
  db.prepare(
    `INSERT INTO channel_themes (id, channel_id, day, label)
     VALUES (@id, @channelId, @day, @label)
     ON CONFLICT (id) DO UPDATE SET day = @day, label = @label`,
  ).run(theme);
}

export function getPlaylistId(db: Database.Database, themeId: string): string | null {
  const row = db
    .prepare<[string], { youtube_playlist_id: string | null }>(
      "SELECT youtube_playlist_id FROM channel_themes WHERE id = ?",
    )
    .get(themeId);
  return row?.youtube_playlist_id ?? null;
}

export function setPlaylistId(db: Database.Database, themeId: string, playlistId: string): void {
  db.prepare("UPDATE channel_themes SET youtube_playlist_id = ? WHERE id = ?").run(
    playlistId,
    themeId,
  );
}
