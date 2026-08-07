import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "./schema.js";
import { getUsedTrackIds, recordTrackUsage } from "./tracks-used-repository.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  db.prepare("INSERT INTO channels (id, name, language, visibility) VALUES (?, ?, ?, ?)").run(
    "blindtest-fr",
    "BlindTest FR",
    "fr",
    "private",
  );
  db.prepare(
    "INSERT INTO channel_themes (id, channel_id, day, label, youtube_playlist_id) VALUES (?, ?, ?, ?, ?)",
  ).run("annees-80", "blindtest-fr", "monday", "Années 80", null);
});

describe("tracks_used repository", () => {
  it("returns an empty set for a channel with no history", () => {
    expect(getUsedTrackIds(db, "blindtest-fr")).toEqual(new Set());
  });

  it("records a track usage and makes it show up in the used set", () => {
    recordTrackUsage(db, {
      channelId: "blindtest-fr",
      themeId: "annees-80",
      spotifyTrackId: "track-1",
      title: "Title",
      artist: "Artist",
      videoId: null,
      usedAt: new Date("2026-08-07T00:00:00Z"),
    });

    expect(getUsedTrackIds(db, "blindtest-fr")).toEqual(new Set(["track-1"]));
  });

  it("rejects recording the same track twice for the same channel", () => {
    const usage = {
      channelId: "blindtest-fr",
      themeId: "annees-80",
      spotifyTrackId: "track-1",
      title: "Title",
      artist: "Artist",
      videoId: null,
      usedAt: new Date("2026-08-07T00:00:00Z"),
    };

    recordTrackUsage(db, usage);

    expect(() => recordTrackUsage(db, usage)).toThrow();
  });
});
