import { SCHEMA_SQL } from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { selectDevineLaChansonTracks } from "./devine-la-chanson.js";

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
  id: string,
  albumCoverUrl = `https://cover.example.com/${id}.jpg`,
): SpotifyTrackMetadata {
  return {
    id,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    artistNames: [`Artist ${id}`],
    albumCoverUrl,
    popularityRank: 0,
    popularity: 50,
    releaseDate: "2000-01-01",
  };
}

function fakeSpotify(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn(),
    getTrackById: vi.fn().mockImplementation((id: string) => Promise.resolve(metadata(id))),
    searchArtists: vi.fn(),
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

describe("selectDevineLaChansonTracks", () => {
  it("returns the episode's first `count` tracks in insertion order", async () => {
    insertTrackUsage("video-1", "track-1", "Song 1", "Artist 1");
    insertTrackUsage("video-1", "track-2", "Song 2", "Artist 2");
    insertTrackUsage("video-1", "track-3", "Song 3", "Artist 3");

    const result = await selectDevineLaChansonTracks(
      db,
      fakeSpotify(),
      fakeItunes(),
      "video-1",
      2,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Song 1", "Song 2"]);
  });

  it("only pulls tracks belonging to the requested episode", async () => {
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
    insertTrackUsage("video-2", "track-2", "Other Episode Song", "Other Artist");

    const result = await selectDevineLaChansonTracks(
      db,
      fakeSpotify(),
      fakeItunes(),
      "video-1",
      5,
      0,
    );

    expect(result.map((t) => t.title)).toEqual(["Song 1"]);
  });

  it("does not fall back to further tracks when a candidate has no iTunes preview", async () => {
    insertTrackUsage("video-1", "track-1", "Song 1", "Artist 1");
    insertTrackUsage("video-1", "track-2", "Song 2", "Artist 2");
    insertTrackUsage("video-1", "track-3", "Song 3", "Artist 3");
    const itunes = fakeItunes({
      findPreviewByTitleAndArtist: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
        previewUrl: "https://preview.example.com/Song 2.m4a",
      }),
    });

    const result = await selectDevineLaChansonTracks(db, fakeSpotify(), itunes, "video-1", 2, 0);

    expect(result.map((t) => t.title)).toEqual(["Song 2"]);
  });
});
