import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getPlaylistId,
  setPlaylistId,
  upsertChannel,
  upsertChannelTheme,
} from "./channel-repository.js";
import { SCHEMA_SQL } from "./schema.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
});

describe("upsertChannel", () => {
  it("inserts a new channel", () => {
    upsertChannel(db, {
      id: "blindtest-fr",
      name: "BlindTest FR",
      language: "fr",
      visibility: "private",
    });

    const row = db.prepare("SELECT * FROM channels WHERE id = ?").get("blindtest-fr");
    expect(row).toMatchObject({ name: "BlindTest FR", visibility: "private" });
  });

  it("updates an existing channel instead of failing", () => {
    upsertChannel(db, {
      id: "blindtest-fr",
      name: "BlindTest FR",
      language: "fr",
      visibility: "private",
    });
    upsertChannel(db, {
      id: "blindtest-fr",
      name: "BlindTest FR",
      language: "fr",
      visibility: "public",
    });

    const row = db.prepare("SELECT visibility FROM channels WHERE id = ?").get("blindtest-fr");
    expect(row).toEqual({ visibility: "public" });
  });
});

describe("upsertChannelTheme + playlist id", () => {
  beforeEach(() => {
    upsertChannel(db, {
      id: "blindtest-fr",
      name: "BlindTest FR",
      language: "fr",
      visibility: "private",
    });
  });

  it("returns null for a theme with no playlist yet", () => {
    upsertChannelTheme(db, {
      id: "annees-80",
      channelId: "blindtest-fr",
      day: "monday",
      label: "Années 80",
    });

    expect(getPlaylistId(db, "annees-80")).toBeNull();
  });

  it("persists a playlist id once set", () => {
    upsertChannelTheme(db, {
      id: "annees-80",
      channelId: "blindtest-fr",
      day: "monday",
      label: "Années 80",
    });

    setPlaylistId(db, "annees-80", "PL123");

    expect(getPlaylistId(db, "annees-80")).toBe("PL123");
  });

  it("does not clear the playlist id when the theme is upserted again", () => {
    upsertChannelTheme(db, {
      id: "annees-80",
      channelId: "blindtest-fr",
      day: "monday",
      label: "Années 80",
    });
    setPlaylistId(db, "annees-80", "PL123");

    upsertChannelTheme(db, {
      id: "annees-80",
      channelId: "blindtest-fr",
      day: "monday",
      label: "Années 80 (v2)",
    });

    expect(getPlaylistId(db, "annees-80")).toBe("PL123");
  });
});
