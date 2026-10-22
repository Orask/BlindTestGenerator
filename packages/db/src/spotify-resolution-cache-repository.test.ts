import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { recordSpotifyResolution } from "./spotify-resolution-cache-repository.js";
import { SCHEMA_SQL } from "./schema.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
});

function row(cacheKey: string) {
  return db.prepare("SELECT * FROM spotify_resolution_cache WHERE cache_key = ?").get(cacheKey) as
    Record<string, unknown> | undefined;
}

describe("recordSpotifyResolution", () => {
  it("records a resolved pair with its Spotify track id", () => {
    recordSpotifyResolution(db, "king|sch", "resolved", "6fDugycTn0ManjOWFaiwbg");

    expect(row("king|sch")).toMatchObject({
      status: "resolved",
      spotify_track_id: "6fDugycTn0ManjOWFaiwbg",
    });
  });

  it("records a not_found outcome with a null track id", () => {
    recordSpotifyResolution(db, "pourquoi les hommes ?|vitaa", "not_found", null);

    expect(row("pourquoi les hommes ?|vitaa")).toMatchObject({
      status: "not_found",
      spotify_track_id: null,
    });
  });

  it("overwrites a stale outcome for the same key once an operator fixes the underlying typo", () => {
    recordSpotifyResolution(db, "pourquoi les hommes ?|vitaa", "not_found", null);
    recordSpotifyResolution(db, "pourquoi les hommes ?|vitaa", "resolved", "abc123");

    expect(row("pourquoi les hommes ?|vitaa")).toMatchObject({
      status: "resolved",
      spotify_track_id: "abc123",
    });
  });
});
