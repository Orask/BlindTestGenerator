import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";

// One-time migration for databases created before tracks_used dropped its
// (channel_id, spotify_track_id) primary key (see schema.ts) — SQLite has
// no ALTER TABLE for dropping a primary key, so the table is rebuilt.
function migrateTracksUsedPrimaryKey(db: Database.Database): void {
  const existing = db
    .prepare<[], { sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tracks_used'",
    )
    .get();
  if (!existing?.sql.includes("PRIMARY KEY (channel_id, spotify_track_id)")) {
    return;
  }

  db.transaction(() => {
    db.exec("ALTER TABLE tracks_used RENAME TO tracks_used_old");
    db.exec(SCHEMA_SQL);
    db.exec(`
      INSERT INTO tracks_used (channel_id, theme_id, spotify_track_id, title, artist, used_at, video_id)
      SELECT channel_id, theme_id, spotify_track_id, title, artist, used_at, video_id FROM tracks_used_old
    `);
    db.exec("DROP TABLE tracks_used_old");
  })();
}

export function openDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  migrateTracksUsedPrimaryKey(db);
  return db;
}
