import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getCachedItunesPreview,
  setCachedItunesPreview,
} from "./itunes-preview-cache-repository.js";
import { SCHEMA_SQL } from "./schema.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
});

describe("itunes preview cache", () => {
  it("returns undefined for a key that was never cached — a true cache miss", () => {
    expect(getCachedItunesPreview(db, "derniere danse|indila")).toBeUndefined();
  });

  it("returns the cached preview URL for a hit", () => {
    setCachedItunesPreview(db, "derniere danse|indila", "https://preview.example.com/a.m4a");

    expect(getCachedItunesPreview(db, "derniere danse|indila")).toBe(
      "https://preview.example.com/a.m4a",
    );
  });

  it("caches a confirmed 'no preview found' as null, distinct from a true miss (undefined)", () => {
    setCachedItunesPreview(db, "obscure song|obscure artist", null);

    expect(getCachedItunesPreview(db, "obscure song|obscure artist")).toBeNull();
  });

  it("overwrites an earlier cached value for the same key, leaving other keys alone", () => {
    setCachedItunesPreview(db, "a|artist-a", "https://preview.example.com/old.m4a");
    setCachedItunesPreview(db, "b|artist-b", "https://preview.example.com/b.m4a");
    setCachedItunesPreview(db, "a|artist-a", "https://preview.example.com/new.m4a");

    expect(getCachedItunesPreview(db, "a|artist-a")).toBe("https://preview.example.com/new.m4a");
    expect(getCachedItunesPreview(db, "b|artist-b")).toBe("https://preview.example.com/b.m4a");
  });
});
