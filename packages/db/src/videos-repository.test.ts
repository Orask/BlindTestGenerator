import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { upsertChannel, upsertChannelTheme } from "./channel-repository.js";
import { SCHEMA_SQL } from "./schema.js";
import {
  countVideosForTheme,
  createVideo,
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
});
