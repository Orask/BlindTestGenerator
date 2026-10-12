import { SCHEMA_SQL } from "@blindtest/db";
import type { ItunesClient, ItunesPreviewResult } from "@blindtest/itunes";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCachingItunesClient } from "./caching-itunes-client.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
});

function fakeInner(
  findPreviewByTitleAndArtist: (
    title: string,
    artist: string,
  ) => Promise<ItunesPreviewResult | null> = vi
    .fn()
    .mockResolvedValue({ previewUrl: "https://preview.example.com/a.m4a" }),
): ItunesClient {
  return { findPreviewByTitleAndArtist };
}

describe("createCachingItunesClient", () => {
  it("calls the inner client on a cache miss and returns its result", async () => {
    const findPreviewByTitleAndArtist = vi
      .fn()
      .mockResolvedValue({ previewUrl: "https://preview.example.com/a.m4a" });
    const client = createCachingItunesClient(db, fakeInner(findPreviewByTitleAndArtist));

    const result = await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");

    expect(result).toEqual({ previewUrl: "https://preview.example.com/a.m4a" });
    expect(findPreviewByTitleAndArtist).toHaveBeenCalledTimes(1);
  });

  it("does not call the inner client again for the same (title, artist) pair", async () => {
    const findPreviewByTitleAndArtist = vi
      .fn()
      .mockResolvedValue({ previewUrl: "https://preview.example.com/a.m4a" });
    const client = createCachingItunesClient(db, fakeInner(findPreviewByTitleAndArtist));

    await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");
    const second = await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");

    expect(second).toEqual({ previewUrl: "https://preview.example.com/a.m4a" });
    expect(findPreviewByTitleAndArtist).toHaveBeenCalledTimes(1);
  });

  it("matches the same pair case/diacritic-insensitively", async () => {
    const findPreviewByTitleAndArtist = vi
      .fn()
      .mockResolvedValue({ previewUrl: "https://preview.example.com/a.m4a" });
    const client = createCachingItunesClient(db, fakeInner(findPreviewByTitleAndArtist));

    await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");
    await client.findPreviewByTitleAndArtist("derniere DANSE", "INDILA");

    expect(findPreviewByTitleAndArtist).toHaveBeenCalledTimes(1);
  });

  it("caches a confirmed 'no preview found' too, without re-querying it later", async () => {
    const findPreviewByTitleAndArtist = vi.fn().mockResolvedValue(null);
    const client = createCachingItunesClient(db, fakeInner(findPreviewByTitleAndArtist));

    const first = await client.findPreviewByTitleAndArtist("Obscure Song", "Obscure Artist");
    const second = await client.findPreviewByTitleAndArtist("Obscure Song", "Obscure Artist");

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(findPreviewByTitleAndArtist).toHaveBeenCalledTimes(1);
  });

  it("still calls the inner client separately for genuinely different pairs", async () => {
    const findPreviewByTitleAndArtist = vi
      .fn()
      .mockResolvedValue({ previewUrl: "https://preview.example.com/a.m4a" });
    const client = createCachingItunesClient(db, fakeInner(findPreviewByTitleAndArtist));

    await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");
    await client.findPreviewByTitleAndArtist("Formidable", "Stromae");

    expect(findPreviewByTitleAndArtist).toHaveBeenCalledTimes(2);
  });
});
