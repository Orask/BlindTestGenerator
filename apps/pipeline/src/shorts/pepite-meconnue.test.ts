import { SCHEMA_SQL } from "@blindtest/db";
import type { DeezerClient } from "@blindtest/deezer";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectPepiteMeconnueTracks } from "./pepite-meconnue.js";

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

function insertTrackUsage(
  videoId: string,
  spotifyTrackId: string,
  title: string,
  artist: string,
): void {
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
    videoId,
  );
}

function metadata(albumCoverUrl = "https://cover.example.com/x.jpg"): SpotifyTrackMetadata {
  return {
    id: "irrelevant",
    title: "irrelevant",
    artist: "irrelevant",
    artistNames: ["irrelevant"],
    albumCoverUrl,
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

describe("selectPepiteMeconnueTracks", () => {
  it("picks the least popular tracks of the episode, not insertion order", async () => {
    insertTrackUsage("video-1", "track-1", "Popular Song", "Artist 1");
    insertTrackUsage("video-1", "track-2", "Hidden Gem", "Artist 2");
    insertTrackUsage("video-1", "track-3", "Mid Song", "Artist 3");
    const deezer = fakeDeezer({ "Popular Song": 900000, "Hidden Gem": 5, "Mid Song": 500000 });

    const result = await selectPepiteMeconnueTracks(
      db,
      fakeSpotify(),
      deezer,
      fakeItunes(),
      "video-1",
      2,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Hidden Gem", "Mid Song"]);
  });

  it("only considers tracks belonging to the requested episode", async () => {
    db.prepare(
      "INSERT INTO videos (id, channel_id, theme_id, created_at, status, visibility, format) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "video-2",
      "blindtest-fr",
      "annees-80",
      "2026-08-14T00:00:00Z",
      "uploaded",
      "public",
      "long",
    );
    insertTrackUsage("video-1", "track-1", "Song 1", "Artist 1");
    insertTrackUsage("video-2", "track-2", "Other Episode Least Popular", "Other Artist");
    const deezer = fakeDeezer({ "Song 1": 500000, "Other Episode Least Popular": 1 });

    const result = await selectPepiteMeconnueTracks(
      db,
      fakeSpotify(),
      deezer,
      fakeItunes(),
      "video-1",
      5,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Song 1"]);
  });

  it("falls back to the next-least-popular track when one has no iTunes preview", async () => {
    insertTrackUsage("video-1", "track-1", "Least Popular", "Artist 1");
    insertTrackUsage("video-1", "track-2", "Second Least Popular", "Artist 2");
    insertTrackUsage("video-1", "track-3", "Most Popular", "Artist 3");
    const deezer = fakeDeezer({
      "Least Popular": 1,
      "Second Least Popular": 200000,
      "Most Popular": 900000,
    });
    const itunes = fakeItunes({
      findPreviewByTitleAndArtist: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        previewUrl: "https://preview.example.com/Second Least Popular.m4a",
      }),
    });

    const result = await selectPepiteMeconnueTracks(
      db,
      fakeSpotify(),
      deezer,
      itunes,
      "video-1",
      1,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Second Least Popular"]);
  });
});
