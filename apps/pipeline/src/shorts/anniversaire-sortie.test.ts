import { SCHEMA_SQL } from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import Database from "better-sqlite3";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAnniversaryMatches, hydrateAnniversaryTrack } from "./anniversaire-sortie.js";

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

function metadata(releaseDate: string): SpotifyTrackMetadata {
  return {
    id: "irrelevant",
    title: "irrelevant",
    artist: "irrelevant",
    artistNames: ["irrelevant"],
    albumCoverUrl: "https://cover.example.com/x.jpg",
    popularityRank: 0,
    popularity: 50,
    releaseDate,
  };
}

function fakeSpotify(byTrackId: Record<string, string>): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn(),
    getTrackById: vi
      .fn()
      .mockImplementation((id: string) => Promise.resolve(metadata(byTrackId[id] ?? ""))),
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

describe("findAnniversaryMatches", () => {
  it("matches a track whose release month+day equals the reference date, from an earlier year", async () => {
    insertTrackUsage("track-1", "Anniversary Song", "Artist 1");
    const spotify = fakeSpotify({ "track-1": "2014-09-27" });

    const result = await findAnniversaryMatches(
      db,
      spotify,
      "blindtest-fr",
      new Date("2026-09-27T00:00:00Z"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: "Anniversary Song", yearsAgo: 12 });
  });

  it("ignores tracks whose release month/day does not match", async () => {
    insertTrackUsage("track-1", "Not Today", "Artist 1");
    const spotify = fakeSpotify({ "track-1": "2014-01-15" });

    const result = await findAnniversaryMatches(
      db,
      spotify,
      "blindtest-fr",
      new Date("2026-09-27T00:00:00Z"),
    );

    expect(result).toEqual([]);
  });

  it("ignores a track released the same year as the reference date (not yet one year old)", async () => {
    insertTrackUsage("track-1", "Brand New", "Artist 1");
    const spotify = fakeSpotify({ "track-1": "2026-09-27" });

    const result = await findAnniversaryMatches(
      db,
      spotify,
      "blindtest-fr",
      new Date("2026-09-27T00:00:00Z"),
    );

    expect(result).toEqual([]);
  });

  it("finds an upcoming match within the window without matching referenceDate itself", async () => {
    insertTrackUsage("track-1", "Upcoming Anniversary", "Artist 1");
    const spotify = fakeSpotify({ "track-1": "2016-10-02" });

    const result = await findAnniversaryMatches(
      db,
      spotify,
      "blindtest-fr",
      new Date("2026-09-27T00:00:00Z"),
      7,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: "Upcoming Anniversary", yearsAgo: 10 });
  });

  it("skips a track with an unparseable release date without throwing", async () => {
    insertTrackUsage("track-1", "Bad Date", "Artist 1");
    const spotify = fakeSpotify({ "track-1": "" });

    const result = await findAnniversaryMatches(
      db,
      spotify,
      "blindtest-fr",
      new Date("2026-09-27T00:00:00Z"),
    );

    expect(result).toEqual([]);
  });

  it("treats a year-only release_date precision as January 1st", async () => {
    insertTrackUsage("track-1", "Year Only", "Artist 1");
    const spotify = fakeSpotify({ "track-1": "2010" });

    const result = await findAnniversaryMatches(
      db,
      spotify,
      "blindtest-fr",
      new Date("2026-01-01T00:00:00Z"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: "Year Only", yearsAgo: 16 });
  });
});

describe("hydrateAnniversaryTrack", () => {
  it("resolves an iTunes preview for the matched track", async () => {
    const match = {
      spotifyTrackId: "track-1",
      title: "Anniversary Song",
      artist: "Artist 1",
      albumCoverUrl: "https://cover.example.com/x.jpg",
      releaseDate: "2014-09-27",
      matchDate: new Date("2026-09-27T00:00:00Z"),
      yearsAgo: 12,
    };

    const result = await hydrateAnniversaryTrack(fakeItunes(), match, 0);

    expect(result).toEqual({
      title: "Anniversary Song",
      artist: "Artist 1",
      albumCoverUrl: "https://cover.example.com/x.jpg",
      audioUrl: "https://preview.example.com/Anniversary Song.m4a",
    });
  });

  it("returns null when no iTunes preview is available", async () => {
    const match = {
      spotifyTrackId: "track-1",
      title: "Anniversary Song",
      artist: "Artist 1",
      albumCoverUrl: "https://cover.example.com/x.jpg",
      releaseDate: "2014-09-27",
      matchDate: new Date("2026-09-27T00:00:00Z"),
      yearsAgo: 12,
    };
    const itunes = fakeItunes({ findPreviewByTitleAndArtist: vi.fn().mockResolvedValue(null) });

    const result = await hydrateAnniversaryTrack(itunes, match, 0);

    expect(result).toBeNull();
  });
});
