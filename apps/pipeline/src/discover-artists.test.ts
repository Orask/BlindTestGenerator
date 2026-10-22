import type { AnthropicClient } from "@blindtest/anthropic";
import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import { describe, expect, it, vi } from "vitest";
import { discoverNewArtists } from "./discover-artists.js";

function fakeAnthropic(complete: AnthropicClient["complete"]): AnthropicClient {
  return { complete };
}

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

  it("over-collects candidates and keeps only the ones an AI notoriety check approves", async () => {
    const names = ["A1", "A2", "A3", "A4", "A5", "A6"];
    const spotify = fakeSpotify({ searchArtists: vi.fn().mockResolvedValueOnce(names) });
    const complete = vi.fn().mockResolvedValue('{"known": [2, 5]}');
    const anthropic = fakeAnthropic(complete);

    // maxNew=2 with an anthropic client over-collects up to 2*3=6 verified
    // candidates first — all 6 are supplied in one page here, so there's
    // no need for a 2nd page despite maxNew being only 2.
    const result = await discoverNewArtists(spotify, "rap francais", [], 2, anthropic);

    expect(result).toEqual(["A2", "A5"]);
    expect(complete).toHaveBeenCalledTimes(1);
    const prompt = complete.mock.calls[0]![0].prompt as string;
    expect(prompt).toContain("1. A1");
    expect(prompt).toContain("6. A6");
  });

  it("rejects every candidate when the AI response is malformed JSON", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValueOnce(["A1", "A2"]).mockResolvedValue([]),
    });
    const anthropic = fakeAnthropic(vi.fn().mockResolvedValue("not json at all"));

    const result = await discoverNewArtists(spotify, "rap francais", [], 2, anthropic);

    expect(result).toEqual([]);
  });

  it("rejects every candidate when the AI call itself fails", async () => {
    const spotify = fakeSpotify({
      searchArtists: vi.fn().mockResolvedValueOnce(["A1", "A2"]).mockResolvedValue([]),
    });
    const anthropic = fakeAnthropic(vi.fn().mockRejectedValue(new Error("network error")));

    const result = await discoverNewArtists(spotify, "rap francais", [], 2, anthropic);

    expect(result).toEqual([]);
  });

  it("never calls the AI when there are no live-verified candidates to judge", async () => {
    const spotify = fakeSpotify({ searchArtists: vi.fn().mockResolvedValue([]) });
    const complete = vi.fn();
    const anthropic = fakeAnthropic(complete);

    const result = await discoverNewArtists(spotify, "obscure query", [], 5, anthropic);

    expect(result).toEqual([]);
    expect(complete).not.toHaveBeenCalled();
  });
});
