import { SCHEMA_SQL } from "@blindtest/db";
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

function metadata(
  popularity: number,
  albumCoverUrl = "https://cover.example.com/x.jpg",
): SpotifyTrackMetadata {
  return {
    id: "irrelevant",
    title: "irrelevant",
    artist: "irrelevant",
    artistNames: ["irrelevant"],
    albumCoverUrl,
    popularityRank: 0,
    popularity,
    releaseDate: "2000-01-01",
  };
}

function fakeSpotify(byTrackId: Record<string, number>): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn(),
    getTrackById: vi
      .fn()
      .mockImplementation((id: string) => Promise.resolve(metadata(byTrackId[id] ?? 0))),
    searchArtists: vi.fn(),
    searchTrackByTitleAndArtist: vi.fn(),
    getArtistImage: vi.fn(),
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
    const spotify = fakeSpotify({ "track-1": 90, "track-2": 5, "track-3": 50 });

    const result = await selectPepiteMeconnueTracks(db, spotify, fakeItunes(), "video-1", 2, 0);

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
    const spotify = fakeSpotify({ "track-1": 50, "track-2": 1 });

    const result = await selectPepiteMeconnueTracks(db, spotify, fakeItunes(), "video-1", 5, 0);

    expect(result.map((t) => t.title)).toEqual(["Song 1"]);
  });

  it("falls back to the next-least-popular track when one has no iTunes preview", async () => {
    insertTrackUsage("video-1", "track-1", "Least Popular", "Artist 1");
    insertTrackUsage("video-1", "track-2", "Second Least Popular", "Artist 2");
    insertTrackUsage("video-1", "track-3", "Most Popular", "Artist 3");
    const spotify = fakeSpotify({ "track-1": 1, "track-2": 20, "track-3": 90 });
    const itunes = fakeItunes({
      findPreviewByTitleAndArtist: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        previewUrl: "https://preview.example.com/Second Least Popular.m4a",
      }),
    });

    const result = await selectPepiteMeconnueTracks(db, spotify, itunes, "video-1", 1, 0);

    expect(result.map((t) => t.title)).toEqual(["Second Least Popular"]);
  });
});
