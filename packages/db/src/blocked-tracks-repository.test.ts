import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { blockTrack, getBlockedTrackIds } from "./blocked-tracks-repository.js";
import { upsertChannel } from "./channel-repository.js";
import { SCHEMA_SQL } from "./schema.js";

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
});

describe("blocked tracks", () => {
  const blockedAt = new Date("2026-09-25T09:00:00Z");

  it("returns an empty set when nothing is blocked", () => {
    expect(getBlockedTrackIds(db)).toEqual(new Set());
  });

  it("returns every blocked track id", () => {
    blockTrack(db, {
      spotifyTrackId: "id-1",
      channelId: "blindtest-fr",
      title: "Avant toi",
      artist: "Vitaa, Slimane",
      reason: "Content ID: bloqué dans le monde entier",
      blockedAt,
    });
    blockTrack(db, {
      spotifyTrackId: "id-2",
      channelId: "blindtest-fr",
      title: "Reine",
      artist: "Dadju",
      reason: "Content ID: bloqué dans le monde entier",
      blockedAt,
    });

    expect(getBlockedTrackIds(db)).toEqual(new Set(["id-1", "id-2"]));
  });

  it("updates the reason instead of erroring when the same track is blocked again", () => {
    blockTrack(db, {
      spotifyTrackId: "id-1",
      channelId: "blindtest-fr",
      title: "Avant toi",
      artist: "Vitaa, Slimane",
      reason: "first reason",
      blockedAt,
    });
    blockTrack(db, {
      spotifyTrackId: "id-1",
      channelId: "blindtest-fr",
      title: "Avant toi",
      artist: "Vitaa, Slimane",
      reason: "updated reason",
      blockedAt,
    });

    expect(getBlockedTrackIds(db)).toEqual(new Set(["id-1"]));
  });

  it("records which channel the claim was found on", () => {
    blockTrack(db, {
      spotifyTrackId: "id-1",
      channelId: "blindtest-fr",
      title: "Avant toi",
      artist: "Vitaa, Slimane",
      reason: "Content ID: bloqué dans le monde entier",
      blockedAt,
    });

    const row = db
      .prepare("SELECT channel_id FROM blocked_tracks WHERE spotify_track_id = ?")
      .get("id-1");
    expect(row).toEqual({ channel_id: "blindtest-fr" });
  });
});
