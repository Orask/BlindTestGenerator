import { SCHEMA_SQL } from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectNewReleaseTracks, titleArtistKey } from "./nouveaute-genre.js";

let db: Database.Database;
const REFERENCE_DATE = new Date("2026-09-27T00:00:00Z");

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
  ).run("rap-fr", "blindtest-fr", "thursday", "Rap FR", null);
});

function insertTrackUsage(spotifyTrackId: string, title: string, artist: string): void {
  db.prepare(
    `INSERT INTO tracks_used (channel_id, theme_id, spotify_track_id, title, artist, used_at, video_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("blindtest-fr", "rap-fr", spotifyTrackId, title, artist, "2026-08-07T00:00:00Z", null);
}

function track(
  id: string,
  title: string,
  artist: string,
  releaseDate: string,
): SpotifyTrackMetadata {
  return {
    id,
    title,
    artist,
    artistNames: [artist],
    albumCoverUrl: `https://cover.example.com/${id}.jpg`,
    popularityRank: 0,
    popularity: 50,
    releaseDate,
  };
}

function fakeSpotify(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn().mockResolvedValue([]),
    getTrackById: vi.fn(),
    searchArtists: vi.fn().mockResolvedValue([]),
    searchTrackByTitleAndArtist: vi.fn(),
    getArtistImage: vi.fn(),
    ...overrides,
  };
}

function fakeItunes(overrides: Partial<ItunesClient> = {}): ItunesClient {
  return {
    findPreviewByTitleAndArtist: vi
      .fn()
      .mockImplementation((title: string) =>
        Promise.resolve({ previewUrl: `https://preview.example.com/${title}.m4a` }),
      ),
    ...overrides,
  };
}

describe("selectNewReleaseTracks", () => {
  it("picks the most recent releases across the artists a genre search returns", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValue(["Artist A", "Artist B"]),
      searchTracksByArtist: vi.fn().mockImplementation((artistName: string) => {
        if (artistName === "Artist A") {
          return Promise.resolve([track("a1", "Older Track", "Artist A", "2026-08-01")]);
        }
        return Promise.resolve([track("b1", "Newest Track", "Artist B", "2026-09-20")]);
      }),
    });

    const result = await selectNewReleaseTracks(
      db,
      spotify,
      fakeItunes(),
      "blindtest-fr",
      "rap francais",
      2,
      REFERENCE_DATE,
      undefined,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Newest Track", "Older Track"]);
  });

  it("excludes a track already recorded in tracks_used for the channel", async () => {
    insertTrackUsage("a1", "Already Used", "Artist A");
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValue(["Artist A"]),
      searchTracksByArtist: vi
        .fn()
        .mockResolvedValue([track("a1", "Already Used", "Artist A", "2026-09-20")]),
    });

    const result = await selectNewReleaseTracks(
      db,
      spotify,
      fakeItunes(),
      "blindtest-fr",
      "rap francais",
      2,
      REFERENCE_DATE,
      undefined,
      0,
    );

    expect(result).toEqual([]);
  });

  it("excludes a track matching a caller-supplied curatedTracks key", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValue(["Artist A"]),
      searchTracksByArtist: vi
        .fn()
        .mockResolvedValue([track("a1", "Curated Song", "Artist A", "2026-09-20")]),
    });
    const excludeKeys = new Set([titleArtistKey("Curated Song", "Artist A")]);

    const result = await selectNewReleaseTracks(
      db,
      spotify,
      fakeItunes(),
      "blindtest-fr",
      "rap francais",
      2,
      REFERENCE_DATE,
      excludeKeys,
      0,
    );

    expect(result).toEqual([]);
  });

  it("excludes a track older than the freshness cutoff", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValue(["Artist A"]),
      searchTracksByArtist: vi
        .fn()
        .mockResolvedValue([track("a1", "Old Catalog Track", "Artist A", "2024-01-01")]),
    });

    const result = await selectNewReleaseTracks(
      db,
      spotify,
      fakeItunes(),
      "blindtest-fr",
      "rap francais",
      2,
      REFERENCE_DATE,
      undefined,
      0,
    );

    expect(result).toEqual([]);
  });

  it("excludes a track dated in the future relative to the reference date", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValue(["Artist A"]),
      searchTracksByArtist: vi
        .fn()
        .mockResolvedValue([track("a1", "Future Track", "Artist A", "2026-12-01")]),
    });

    const result = await selectNewReleaseTracks(
      db,
      spotify,
      fakeItunes(),
      "blindtest-fr",
      "rap francais",
      2,
      REFERENCE_DATE,
      undefined,
      0,
    );

    expect(result).toEqual([]);
  });

  it("falls back to the next candidate when one has no iTunes preview", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValue(["Artist A", "Artist B"]),
      searchTracksByArtist: vi.fn().mockImplementation((artistName: string) => {
        if (artistName === "Artist A") {
          return Promise.resolve([track("a1", "No Preview Track", "Artist A", "2026-09-25")]);
        }
        return Promise.resolve([track("b1", "Has Preview Track", "Artist B", "2026-09-15")]);
      }),
    });
    const itunes = fakeItunes({
      findPreviewByTitleAndArtist: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        previewUrl: "https://preview.example.com/Has Preview Track.m4a",
      }),
    });

    const result = await selectNewReleaseTracks(
      db,
      spotify,
      itunes,
      "blindtest-fr",
      "rap francais",
      1,
      REFERENCE_DATE,
      undefined,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Has Preview Track"]);
  });
});
