import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import { describe, expect, it, vi } from "vitest";
import { discoverNewArtists } from "./discover-artists.js";

function verified(): SpotifyTrackMetadata[] {
  return [
    {
      id: "1",
      title: "Some Song",
      artist: "Some Artist",
      artistNames: ["Some Artist"],
      albumCoverUrl: "",
      popularityRank: 0,
    },
  ];
}

function fakeSpotify(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn().mockResolvedValue(verified()),
    getTrackById: vi.fn(),
    searchArtists: vi.fn().mockResolvedValue([]),
    searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("discoverNewArtists", () => {
  it("returns live-verified artists not already in the existing list", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValueOnce(["Jul", "Ninho"]).mockResolvedValue([]),
    });

    const result = await discoverNewArtists(spotify, "rap francais", ["Booba"], 5);

    expect(result).toEqual(["Jul", "Ninho"]);
  });

  it("skips names already present in the existing artist list, case/diacritic-insensitively", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValueOnce(["booba", "Jul"]).mockResolvedValue([]),
    });

    const result = await discoverNewArtists(spotify, "rap francais", ["Booba"], 5);

    expect(result).toEqual(["Jul"]);
  });

  it("discards a candidate that fails live verification (e.g. a compilation/pseudo-artist entry)", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi
        .fn()
        .mockResolvedValueOnce(["Tubes des années 90", "Zazie"])
        .mockResolvedValue([]),
      searchTracksByArtist: vi
        .fn()
        .mockResolvedValueOnce([]) // "Tubes des années 90" — no exact-match track
        .mockResolvedValueOnce(verified()), // "Zazie" — verified
    });

    const result = await discoverNewArtists(spotify, "chanson francaise annees 90", [], 5);

    expect(result).toEqual(["Zazie"]);
  });

  it("pages through more results when the first page isn't enough", async () => {
    const searchArtists = vi
      .fn()
      .mockResolvedValueOnce(["Jul"])
      .mockResolvedValueOnce(["Ninho"])
      .mockResolvedValue([]);
    const spotify = fakeSpotify({ searchArtists });

    const result = await discoverNewArtists(spotify, "rap francais", [], 2);

    expect(result).toEqual(["Jul", "Ninho"]);
    expect(searchArtists).toHaveBeenNthCalledWith(1, "rap francais", 10, 0);
    expect(searchArtists).toHaveBeenNthCalledWith(2, "rap francais", 10, 10);
  });

  it("stops once maxNew verified artists are found", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValue(["Jul", "Ninho", "Niska"]),
    });

    const result = await discoverNewArtists(spotify, "rap francais", [], 2);

    expect(result).toEqual(["Jul", "Ninho"]);
  });

  it("returns an empty list when the search itself returns nothing", async () => {
    const spotify = fakeSpotify({ searchArtists: vi.fn().mockResolvedValue([]) });

    const result = await discoverNewArtists(spotify, "obscure query", [], 5);

    expect(result).toEqual([]);
  });
});
