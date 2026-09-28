import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { upsertChannel, upsertChannelTheme } from "./channel-repository.js";
import { SCHEMA_SQL } from "./schema.js";
import {
  countVideosForTheme,
  createVideo,
  getLatestUploadedVideoForTheme,
  hasUploadedVideoForThemeToday,
  markVideoFailed,
  markVideoUploaded,
} from "./videos-repository.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  upsertChannel(db, {
    id: "blindtest-fr",
    name: "BlindTest FR",
    language: "fr",
    visibility: "private",
  });
  upsertChannelTheme(db, {
    id: "annees-80",
    channelId: "blindtest-fr",
    day: "monday",
    label: "Années 80",
  });
});

describe("videos repository", () => {
  it("creates a draft video row", () => {
    createVideo(db, {
      id: "video-1",
      channelId: "blindtest-fr",
      themeId: "annees-80",
      createdAt: new Date("2026-08-07T00:00:00Z"),
      filePath: "/tmp/episode.mp4",
      visibility: "private",
      format: "long",
    });

    const row = db
      .prepare("SELECT status, youtube_video_id FROM videos WHERE id = ?")
      .get("video-1");
    expect(row).toEqual({ status: "draft", youtube_video_id: null });
  });

  it("marks a video as uploaded with its YouTube id", () => {
    createVideo(db, {
      id: "video-1",
      channelId: "blindtest-fr",
      themeId: "annees-80",
      createdAt: new Date("2026-08-07T00:00:00Z"),
      filePath: "/tmp/episode.mp4",
      visibility: "private",
      format: "long",
    });

    markVideoUploaded(db, "video-1", "yt-abc123");

    const row = db
      .prepare("SELECT status, youtube_video_id FROM videos WHERE id = ?")
      .get("video-1");
    expect(row).toEqual({ status: "uploaded", youtube_video_id: "yt-abc123" });
  });

  it("marks a video as failed", () => {
    createVideo(db, {
      id: "video-1",
      channelId: "blindtest-fr",
      themeId: "annees-80",
      createdAt: new Date("2026-08-07T00:00:00Z"),
      filePath: "/tmp/episode.mp4",
      visibility: "private",
      format: "long",
    });

    markVideoFailed(db, "video-1");

    const row = db.prepare("SELECT status FROM videos WHERE id = ?").get("video-1");
    expect(row).toEqual({ status: "failed" });
  });

  it("counts videos recorded for a theme", () => {
    expect(countVideosForTheme(db, "annees-80")).toBe(0);

    createVideo(db, {
      id: "video-1",
      channelId: "blindtest-fr",
      themeId: "annees-80",
      createdAt: new Date("2026-08-07T00:00:00Z"),
      filePath: "/tmp/episode.mp4",
      visibility: "private",
      format: "long",
    });

    expect(countVideosForTheme(db, "annees-80")).toBe(1);
  });

  describe("hasUploadedVideoForThemeToday", () => {
    it("is false when no video exists yet for the theme", () => {
      expect(
        hasUploadedVideoForThemeToday(
          db,
          "blindtest-fr",
          "annees-80",
          new Date("2026-09-27T09:00:00Z"),
        ),
      ).toBe(false);
    });

    it("is false when the same-day attempt never got past draft or failed", () => {
      createVideo(db, {
        id: "video-1",
        channelId: "blindtest-fr",
        themeId: "annees-80",
        createdAt: new Date("2026-09-27T09:06:55Z"),
        filePath: "/tmp/episode.mp4",
        visibility: "public",
        format: "long",
      });
      markVideoFailed(db, "video-1");

      expect(
        hasUploadedVideoForThemeToday(
          db,
          "blindtest-fr",
          "annees-80",
          new Date("2026-09-27T09:33:20Z"),
        ),
      ).toBe(false);
    });

    it("is true once a same-day attempt for the theme reached uploaded", () => {
      createVideo(db, {
        id: "video-1",
        channelId: "blindtest-fr",
        themeId: "annees-80",
        createdAt: new Date("2026-09-27T09:33:20Z"),
        filePath: "/tmp/episode.mp4",
        visibility: "public",
        format: "long",
      });
      markVideoUploaded(db, "video-1", "yt-abc123");

      expect(
        hasUploadedVideoForThemeToday(
          db,
          "blindtest-fr",
          "annees-80",
          new Date("2026-09-27T23:59:00Z"),
        ),
      ).toBe(true);
    });

    it("is false for an uploaded video from a different day", () => {
      createVideo(db, {
        id: "video-1",
        channelId: "blindtest-fr",
        themeId: "annees-80",
        createdAt: new Date("2026-09-26T09:00:00Z"),
        filePath: "/tmp/episode.mp4",
        visibility: "public",
        format: "long",
      });
      markVideoUploaded(db, "video-1", "yt-abc123");

      expect(
        hasUploadedVideoForThemeToday(
          db,
          "blindtest-fr",
          "annees-80",
          new Date("2026-09-27T09:00:00Z"),
        ),
      ).toBe(false);
    });

    it("is false for an uploaded video the same day but a different theme", () => {
      upsertChannelTheme(db, {
        id: "generiques",
        channelId: "blindtest-fr",
        day: "sunday",
        label: "Génériques",
      });
      createVideo(db, {
        id: "video-1",
        channelId: "blindtest-fr",
        themeId: "generiques",
        createdAt: new Date("2026-09-27T09:00:00Z"),
        filePath: "/tmp/episode.mp4",
        visibility: "public",
        format: "long",
      });
      markVideoUploaded(db, "video-1", "yt-abc123");

      expect(
        hasUploadedVideoForThemeToday(
          db,
          "blindtest-fr",
          "annees-80",
          new Date("2026-09-27T09:00:00Z"),
        ),
      ).toBe(false);
    });
  });

  describe("getLatestUploadedVideoForTheme", () => {
    it("returns undefined when the theme has no uploaded video yet", () => {
      expect(getLatestUploadedVideoForTheme(db, "annees-80")).toBeUndefined();
    });

    it("ignores a draft/failed row that never reached uploaded", () => {
      createVideo(db, {
        id: "video-1",
        channelId: "blindtest-fr",
        themeId: "annees-80",
        createdAt: new Date("2026-09-27T09:00:00Z"),
        filePath: "/tmp/episode.mp4",
        visibility: "public",
        format: "long",
      });
      markVideoFailed(db, "video-1");

      expect(getLatestUploadedVideoForTheme(db, "annees-80")).toBeUndefined();
    });

    it("returns the most recently uploaded video for the theme", () => {
      createVideo(db, {
        id: "video-1",
        channelId: "blindtest-fr",
        themeId: "annees-80",
        createdAt: new Date("2026-09-20T09:00:00Z"),
        filePath: "/tmp/episode-1.mp4",
        visibility: "public",
        format: "long",
      });
      markVideoUploaded(db, "video-1", "yt-old");
      createVideo(db, {
        id: "video-2",
        channelId: "blindtest-fr",
        themeId: "annees-80",
        createdAt: new Date("2026-09-27T09:00:00Z"),
        filePath: "/tmp/episode-2.mp4",
        visibility: "public",
        format: "long",
      });
      markVideoUploaded(db, "video-2", "yt-new");

      expect(getLatestUploadedVideoForTheme(db, "annees-80")).toEqual({
        id: "video-2",
        channelId: "blindtest-fr",
        visibility: "public",
      });
    });

    it("only considers the requested format", () => {
      createVideo(db, {
        id: "video-1",
        channelId: "blindtest-fr",
        themeId: "annees-80",
        createdAt: new Date("2026-09-27T09:00:00Z"),
        filePath: "/tmp/short.mp4",
        visibility: "public",
        format: "short",
      });
      markVideoUploaded(db, "video-1", "yt-short");

      expect(getLatestUploadedVideoForTheme(db, "annees-80")).toBeUndefined();
      expect(getLatestUploadedVideoForTheme(db, "annees-80", "short")).toEqual({
        id: "video-1",
        channelId: "blindtest-fr",
        visibility: "public",
      });
    });
  });
});
