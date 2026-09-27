import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "./database.js";

let dir: string;
let dbPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "blindtest-db-test-"));
  dbPath = join(dir, "test.sqlite");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("openDatabase", () => {
  it("creates blocked_tracks with a channel_id column on a fresh database", () => {
    const db = openDatabase(dbPath);
    const columns = db.prepare("PRAGMA table_info(blocked_tracks)").all() as { name: string }[];
    expect(columns.map((c) => c.name)).toContain("channel_id");
    db.close();
  });

  it("backfills channel_id on a database created before that column existed", () => {
    // Simulates the real committed data/blindtest.sqlite as it was before
    // this migration: same table, minus channel_id, with an existing row.
    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE blocked_tracks (
        spotify_track_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        reason TEXT NOT NULL,
        blocked_at TEXT NOT NULL
      );
    `);
    legacy
      .prepare(
        "INSERT INTO blocked_tracks (spotify_track_id, title, artist, reason, blocked_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run("id-1", "Reine", "Dadju", "Content ID", "2026-09-25T16:33:15.745Z");
    legacy.close();

    const db = openDatabase(dbPath);
    const row = db
      .prepare("SELECT channel_id FROM blocked_tracks WHERE spotify_track_id = ?")
      .get("id-1");
    expect(row).toEqual({ channel_id: "blindtest-fr" });
    db.close();
  });

  it("is idempotent — opening an already-migrated database again is a no-op", () => {
    openDatabase(dbPath).close();
    const db = openDatabase(dbPath);
    const columns = db.prepare("PRAGMA table_info(blocked_tracks)").all() as { name: string }[];
    expect(columns.filter((c) => c.name === "channel_id")).toHaveLength(1);
    db.close();
  });
});
