import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "./schema.js";
import {
  getRecentTracksForTheme,
  getUsedTrackIds,
  getUsedTrackIdsSince,
  recordTrackUsage,
} from "./tracks-used-repository.js";

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

  it("allows recording the same track again later (controlled reuse after a cooldown)", () => {
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
    expect(() =>
      recordTrackUsage(db, { ...usage, usedAt: new Date("2026-09-01T00:00:00Z") }),
    ).not.toThrow();
  });
});

describe("getUsedTrackIdsSince", () => {
  it("only returns tracks used at or after the cutoff", () => {
    recordTrackUsage(db, {
      channelId: "blindtest-fr",
      themeId: "annees-80",
      spotifyTrackId: "old-track",
      title: "Old",
      artist: "Artist",
      videoId: null,
      usedAt: new Date("2026-07-01T00:00:00Z"),
    });
    recordTrackUsage(db, {
      channelId: "blindtest-fr",
      themeId: "annees-80",
      spotifyTrackId: "recent-track",
      title: "Recent",
      artist: "Artist",
      videoId: null,
      usedAt: new Date("2026-08-05T00:00:00Z"),
    });

    const result = getUsedTrackIdsSince(db, "blindtest-fr", new Date("2026-08-01T00:00:00Z"));

    expect(result).toEqual(new Set(["recent-track"]));
  });
});

describe("getRecentTracksForTheme", () => {
  it("returns title+artist for tracks used since the cutoff, newest first", () => {
    recordTrackUsage(db, {
      channelId: "blindtest-fr",
      themeId: "annees-80",
      spotifyTrackId: "old-track",
      title: "Old Song",
      artist: "Old Artist",
      videoId: null,
      usedAt: new Date("2026-07-01T00:00:00Z"),
    });
    recordTrackUsage(db, {
      channelId: "blindtest-fr",
      themeId: "annees-80",
      spotifyTrackId: "recent-track",
      title: "Recent Song",
      artist: "Recent Artist",
      videoId: null,
      usedAt: new Date("2026-08-05T00:00:00Z"),
    });

    const result = getRecentTracksForTheme(db, "annees-80", new Date("2026-08-01T00:00:00Z"));

    expect(result).toEqual([{ title: "Recent Song", artist: "Recent Artist" }]);
  });

  it("only returns tracks for the requested theme", () => {
    db.prepare(
      "INSERT INTO channel_themes (id, channel_id, day, label, youtube_playlist_id) VALUES (?, ?, ?, ?, ?)",
    ).run("rap-fr", "blindtest-fr", "thursday", "Rap FR", null);
    recordTrackUsage(db, {
      channelId: "blindtest-fr",
      themeId: "rap-fr",
      spotifyTrackId: "other-theme-track",
      title: "Other Theme Song",
      artist: "Other Artist",
      videoId: null,
      usedAt: new Date("2026-08-05T00:00:00Z"),
    });

    const result = getRecentTracksForTheme(db, "annees-80", new Date("2026-07-01T00:00:00Z"));

    expect(result).toEqual([]);
  });
});
