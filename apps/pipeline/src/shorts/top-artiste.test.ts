import { SCHEMA_SQL } from "@blindtest/db";
import type { DeezerClient } from "@blindtest/deezer";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectTopArtisteTracks } from "./top-artiste.js";

let db: Database.Database;

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
  ).run("annees-80", "blindtest-fr", "monday", "Années 80", null);
  db.prepare(
    "INSERT INTO videos (id, channel_id, theme_id, created_at, status, visibility, format) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    "video-1",
    "blindtest-fr",
    "annees-80",
    "2026-08-07T00:00:00Z",
    "uploaded",
    "public",
    "long",
  );
});

function insertTrackUsage(spotifyTrackId: string, title: string, artist: string): void {
  db.prepare(
    `INSERT INTO tracks_used (channel_id, theme_id, spotify_track_id, title, artist, used_at, video_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    "blindtest-fr",
    "annees-80",
    spotifyTrackId,
    title,
    artist,
    "2026-08-07T00:00:00Z",
    "video-1",
  );
}

function metadata(): SpotifyTrackMetadata {
  return {
    id: "irrelevant",
    title: "irrelevant",
    artist: "irrelevant",
    artistNames: ["irrelevant"],
    albumCoverUrl: "https://cover.example.com/x.jpg",
    popularityRank: 0,
    popularity: 50,
    releaseDate: "2000-01-01",
  };
}

function fakeSpotify(): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn(),
    getTrackById: vi.fn().mockImplementation(() => Promise.resolve(metadata())),
    searchArtists: vi.fn(),
    searchTrackByTitleAndArtist: vi.fn(),
    getArtistImage: vi.fn(),
  };
}

function fakeDeezer(byTitle: Record<string, number>): DeezerClient {
  return {
    getTrackPopularityRank: vi
      .fn()
      .mockImplementation((title: string) => Promise.resolve(byTitle[title] ?? 0)),
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

describe("selectTopArtisteTracks", () => {
  it("only includes tracks credited to the requested artist, sorted by popularity descending", async () => {
    insertTrackUsage("track-1", "Low Hit", "Daft Punk");
    insertTrackUsage("track-2", "Big Hit", "Daft Punk");
    insertTrackUsage("track-3", "Unrelated Song", "Other Artist");
    const deezer = fakeDeezer({ "Low Hit": 20, "Big Hit": 90, "Unrelated Song": 99 });

    const result = await selectTopArtisteTracks(
      db,
      fakeSpotify(),
      deezer,
      fakeItunes(),
      "blindtest-fr",
      "Daft Punk",
      5,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Big Hit", "Low Hit"]);
  });

  it("matches artist credits with diacritics and case differences", async () => {
    insertTrackUsage("track-1", "Halo", "Beyoncé");
    const deezer = fakeDeezer({ Halo: 80 });

    const result = await selectTopArtisteTracks(
      db,
      fakeSpotify(),
      deezer,
      fakeItunes(),
      "blindtest-fr",
      "beyonce",
      5,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Halo"]);
  });

  it("matches a collab credit that includes the requested artist among others", async () => {
    insertTrackUsage("track-1", "Collab Song", "Vitaa, Slimane");
    const deezer = fakeDeezer({ "Collab Song": 80 });

    const result = await selectTopArtisteTracks(
      db,
      fakeSpotify(),
      deezer,
      fakeItunes(),
      "blindtest-fr",
      "Slimane",
      5,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Collab Song"]);
  });

  it("caps the result at `count` tracks", async () => {
    insertTrackUsage("track-1", "Song 1", "Daft Punk");
    insertTrackUsage("track-2", "Song 2", "Daft Punk");
    insertTrackUsage("track-3", "Song 3", "Daft Punk");
    const deezer = fakeDeezer({ "Song 1": 10, "Song 2": 20, "Song 3": 30 });

    const result = await selectTopArtisteTracks(
      db,
      fakeSpotify(),
      deezer,
      fakeItunes(),
      "blindtest-fr",
      "Daft Punk",
      2,
      0,
    );

    expect(result).toHaveLength(2);
  });
});
