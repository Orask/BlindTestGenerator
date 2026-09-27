import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import { describe, expect, it, vi } from "vitest";
import { collectCuratedTracks } from "./collect-curated-tracks.js";

function track(title: string, artist: string): SpotifyTrackMetadata {
  return {
    id: `id-${title}`,
    title,
    artist,
    artistNames: [artist],
    albumCoverUrl: `https://example.com/${title}.jpg`,
    popularityRank: 0,
    popularity: 50,
    releaseDate: "2014-01-20",
  };
}

describe("collectCuratedTracks", () => {
  it("resolves each pair via exact-match search", async () => {
    const searchTrackByTitleAndArtist = vi
      .fn()
      .mockImplementation((title: string) => Promise.resolve(track(title, "Some Artist")));
    const spotify: SpotifyClient = {
      searchTracksByArtist: vi.fn(),
      searchArtists: vi.fn(),
      getTrackById: vi.fn(),
      getArtistImage: vi.fn(),
      searchTrackByTitleAndArtist,
    };

    const result = await collectCuratedTracks(spotify, [
      { title: "Main Title", artist: "Ramin Djawadi" },
      { title: "He's a Pirate", artist: "Klaus Badelt" },
    ]);

    expect(result.map((t) => t.title)).toEqual(["Main Title", "He's a Pirate"]);
    expect(searchTrackByTitleAndArtist).toHaveBeenCalledWith("Main Title", "Ramin Djawadi");
  });

  it("skips a pair with no exact match instead of failing the whole batch", async () => {
    const spotify: SpotifyClient = {
      searchTracksByArtist: vi.fn(),
      searchArtists: vi.fn(),
      getTrackById: vi.fn(),
      getArtistImage: vi.fn(),
      searchTrackByTitleAndArtist: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(track("He's a Pirate", "Klaus Badelt")),
    };

    const result = await collectCuratedTracks(spotify, [
      { title: "Nonexistent Song", artist: "Nobody" },
      { title: "He's a Pirate", artist: "Klaus Badelt" },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("He's a Pirate");
  });
});
