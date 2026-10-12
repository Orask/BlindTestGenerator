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
      popularity: 50,
      releaseDate: "2014-01-20",
    },
  ];
}

function fakeSpotify(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn().mockResolvedValue(verified()),
    getTrackById: vi.fn(),
    searchArtists: vi.fn().mockResolvedValue([]),
    searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(null),
    getArtistImage: vi.fn().mockResolvedValue(null),
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

  it("discards a candidate that fails live verification (e.g. no track at all under that name)", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi
        .fn()
        .mockResolvedValueOnce(["Someone Unverifiable", "Zazie"])
        .mockResolvedValue([]),
      searchTracksByArtist: vi
        .fn()
        .mockResolvedValueOnce([]) // "Someone Unverifiable" — no exact-match track
        .mockResolvedValueOnce(verified()), // "Zazie" — verified
    });

    const result = await discoverNewArtists(spotify, "chanson francaise annees 90", [], 5);

    expect(result).toEqual(["Zazie"]);
  });

  it("rejects a compilation/pseudo-artist name without even calling searchTracksByArtist", async () => {
    const searchTracksByArtist = vi.fn().mockResolvedValue(verified());
    const spotify = fakeSpotify({
      searchArtists: vi
        .fn()
        .mockResolvedValueOnce(["Années 80 Forever", "Le meilleur des années 80", "Zazie"])
        .mockResolvedValue([]),
      searchTracksByArtist,
    });

    const result = await discoverNewArtists(spotify, "chanson francaise annees 80", [], 5);

    expect(result).toEqual(["Zazie"]);
    // Confirms the rejection happens before the API call, not just that
    // it would have failed verification too — a compilation curator has
    // real tracks attributed to it on Spotify, so verification alone
    // would have let both of these through (confirmed live, see the
    // comment on looksLikeCompilation).
    expect(searchTracksByArtist).toHaveBeenCalledTimes(1);
    expect(searchTracksByArtist).toHaveBeenCalledWith("Zazie", 1);
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
