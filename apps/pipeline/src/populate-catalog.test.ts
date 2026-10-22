import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChannelTheme } from "@blindtest/core";
import { openDatabase, upsertChannel, upsertChannelTheme } from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { populateCatalogForTheme } from "./populate-catalog.js";

let db: Database.Database;

function track(id: string, title: string, artist: string): SpotifyTrackMetadata {
  return {
    id,
    title,
    artist,
    artistNames: [artist],
    albumCoverUrl: `https://example.com/${id}.jpg`,
    popularityRank: 0,
    popularity: 50,
    releaseDate: "2020-01-01",
  };
}

function fakeSpotify(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn().mockResolvedValue([]),
    getTrackById: vi.fn(),
    searchArtists: vi.fn().mockResolvedValue([]),
    searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(null),
    getArtistImage: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function fakeItunes(previewFor: (title: string) => boolean): ItunesClient {
  return {
    findPreviewByTitleAndArtist: vi
      .fn()
      .mockImplementation((title: string) =>
        Promise.resolve(
          previewFor(title) ? { previewUrl: `https://preview.example.com/${title}.m4a` } : null,
        ),
      ),
  };
}

async function writeConfig(theme: ChannelTheme): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "populate-catalog-"));
  const path = join(dir, "channel.json");
  await writeFile(path, JSON.stringify({ id: "blindtest-fr", themes: [theme] }), "utf-8");
  return path;
}

function theme(overrides: Partial<ChannelTheme> = {}): ChannelTheme {
  return {
    day: "monday",
    id: "rap-fr",
    label: "Rap FR",
    seedArtists: ["Booba"],
    youtubePlaylistId: null,
    ...overrides,
  };
}

beforeEach(() => {
  db = openDatabase(":memory:");
  upsertChannel(db, {
    id: "blindtest-fr",
    name: "BlindTest FR",
    language: "fr",
    visibility: "private",
  });
  upsertChannelTheme(db, {
    id: "rap-fr",
    channelId: "blindtest-fr",
    day: "monday",
    label: "Rap FR",
  });
});

afterEach(() => {
  db.close();
});

describe("populateCatalogForTheme", () => {
  it("shadow-writes curated and seedArtist candidates and audio-checks them", async () => {
    const spotify = fakeSpotify({
      searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(track("c1", "Tonton du bled", "113")),
      searchTracksByArtist: vi.fn().mockResolvedValue([track("s1", "OKLM", "Booba")]),
    });
    const itunes = fakeItunes(() => true);
    const configPath = await writeConfig(
      theme({ curatedTracks: [{ title: "Tonton du bled", artist: "113" }] }),
    );

    const result = await populateCatalogForTheme(
      db,
      spotify,
      itunes,
      configPath,
      theme({ curatedTracks: [{ title: "Tonton du bled", artist: "113" }] }),
      10,
      0,
    );

    expect(result.discovered).toBe(2);
    expect(result.audioChecked).toBe(2);
    expect(result.promoted).toBe(2);
    expect(result.ineligible).toBe(0);
    expect(result.audioReadyDepth).toBe(2);
    expect(result.discoveryRan).toBe(false);

    const rows = db
      .prepare("SELECT title, status, source FROM catalog_tracks ORDER BY title")
      .all();
    expect(rows).toEqual([
      { title: "OKLM", status: "audio_ready", source: "seed_artist" },
      { title: "Tonton du bled", status: "audio_ready", source: "curated" },
    ]);
  });

  it("records a curated pair's resolution failure instead of silently dropping it", async () => {
    const spotify = fakeSpotify({
      searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(null),
    });
    const configPath = await writeConfig(theme());

    await populateCatalogForTheme(
      db,
      spotify,
      fakeItunes(() => true),
      configPath,
      theme({ curatedTracks: [{ title: "Introuvable", artist: "Personne" }] }),
      10,
      0,
    );

    const cached = db
      .prepare("SELECT status, spotify_track_id FROM spotify_resolution_cache WHERE cache_key = ?")
      .get("introuvable|personne");
    expect(cached).toEqual({ status: "not_found", spotify_track_id: null });
  });

  it("marks a candidate ineligible when iTunes has no preview for it", async () => {
    const spotify = fakeSpotify({
      searchTracksByArtist: vi.fn().mockResolvedValue([track("s1", "No Preview Song", "Booba")]),
    });
    const configPath = await writeConfig(theme());

    const result = await populateCatalogForTheme(
      db,
      spotify,
      fakeItunes(() => false),
      configPath,
      theme(),
      10,
      0,
    );

    expect(result.promoted).toBe(0);
    expect(result.ineligible).toBe(1);
    const row = db
      .prepare("SELECT status, ineligible_reason FROM catalog_tracks WHERE spotify_track_id = 's1'")
      .get();
    expect(row).toEqual({ status: "ineligible", ineligible_reason: "no_itunes_preview" });
  });

  it("skips discovery when audio_ready depth already meets the target", async () => {
    const searchArtists = vi.fn();
    const spotify = fakeSpotify({
      searchTracksByArtist: vi
        .fn()
        .mockResolvedValue([track("s1", "OKLM", "Booba"), track("s2", "DKR", "Booba")]),
      searchArtists,
    });
    const configPath = await writeConfig(theme({ discoveryQuery: "rap francais" }));

    const result = await populateCatalogForTheme(
      db,
      spotify,
      fakeItunes(() => true),
      configPath,
      theme({ discoveryQuery: "rap francais" }),
      2,
      0,
    );

    expect(result.discoveryRan).toBe(false);
    expect(searchArtists).not.toHaveBeenCalled();
  });

  it("runs discovery and persists new artists when still short of the target depth", async () => {
    const spotify = fakeSpotify({
      searchTracksByArtist: vi
        .fn()
        .mockImplementation((artist: string) =>
          Promise.resolve(
            artist === "Booba" ? [] : [track(`d-${artist}`, `Song by ${artist}`, artist)],
          ),
        ),
      searchArtists: vi.fn().mockResolvedValueOnce(["Jul"]).mockResolvedValue([]),
    });
    const configPath = await writeConfig(theme({ discoveryQuery: "rap francais" }));

    const result = await populateCatalogForTheme(
      db,
      spotify,
      fakeItunes(() => true),
      configPath,
      theme({ discoveryQuery: "rap francais" }),
      5,
      0,
    );

    expect(result.discoveryRan).toBe(true);
    const discoveredRow = db
      .prepare("SELECT source FROM catalog_tracks WHERE spotify_track_id = 'd-Jul'")
      .get();
    expect(discoveredRow).toEqual({ source: "discovered" });
  });

  it("bounds the audio-check pass to 2x the target depth per run", async () => {
    const spotify = fakeSpotify({
      searchTracksByArtist: vi
        .fn()
        .mockResolvedValue(
          Array.from({ length: 5 }, (_, i) => track(`s${i}`, `Song ${i}`, "Booba")),
        ),
    });
    const configPath = await writeConfig(theme());

    const result = await populateCatalogForTheme(
      db,
      spotify,
      fakeItunes(() => true),
      configPath,
      theme(),
      2, // target 2 -> at most 4 audio-checked this run
      0,
    );

    expect(result.discovered).toBe(5);
    expect(result.audioChecked).toBe(4);
  });
});
