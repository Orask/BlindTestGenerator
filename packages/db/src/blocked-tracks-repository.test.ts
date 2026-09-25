import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { blockTrack, getBlockedTrackIds } from "./blocked-tracks-repository.js";
import { SCHEMA_SQL } from "./schema.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
});

describe("blocked tracks", () => {
  const blockedAt = new Date("2026-09-25T09:00:00Z");

  it("returns an empty set when nothing is blocked", () => {
    expect(getBlockedTrackIds(db)).toEqual(new Set());
  });

  it("returns every blocked track id", () => {
    blockTrack(db, {
      spotifyTrackId: "id-1",
      title: "Avant toi",
      artist: "Vitaa, Slimane",
      reason: "Content ID: bloqué dans le monde entier",
      blockedAt,
    });
    blockTrack(db, {
      spotifyTrackId: "id-2",
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
      title: "Avant toi",
      artist: "Vitaa, Slimane",
      reason: "first reason",
      blockedAt,
    });
    blockTrack(db, {
      spotifyTrackId: "id-1",
      title: "Avant toi",
      artist: "Vitaa, Slimane",
      reason: "updated reason",
      blockedAt,
    });

    expect(getBlockedTrackIds(db)).toEqual(new Set(["id-1"]));
  });
});
