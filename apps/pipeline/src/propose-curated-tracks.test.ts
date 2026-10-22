import type { AnthropicClient } from "@blindtest/anthropic";
import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import { describe, expect, it, vi } from "vitest";
import { proposeCuratedTracksForArtist } from "./propose-curated-tracks.js";

function fakeAnthropic(complete: AnthropicClient["complete"]): AnthropicClient {
  return { complete };
}

function track(title: string, artist: string): SpotifyTrackMetadata {
  return {
    id: `id-${title}`,
    title,
    artist,
    artistNames: [artist],
    albumCoverUrl: "",
    popularityRank: 0,
    popularity: 50,
    releaseDate: "2020-01-01",
  };
}

function fakeSpotify(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn(),
    getTrackById: vi.fn(),
    searchArtists: vi.fn(),
    searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(null),
    getArtistImage: vi.fn(),
    ...overrides,
  };
}

describe("proposeCuratedTracksForArtist", () => {
  it("keeps only the proposed titles that actually resolve on Spotify", async () => {
    const anthropic = fakeAnthropic(
      vi.fn().mockResolvedValue('{"titles": ["Avant toi", "Morceau Inexistant"]}'),
    );
    const spotify = fakeSpotify({
      searchTrackByTitleAndArtist: vi
        .fn()
        .mockImplementation((title: string) =>
          Promise.resolve(title === "Avant toi" ? track("Avant toi", "Vitaa") : null),
        ),
    });

    const result = await proposeCuratedTracksForArtist(anthropic, spotify, "Vitaa", "Rap FR", 2);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: "Avant toi", artist: "Vitaa" });
  });

  it("returns Spotify's own title, not the AI's spelling — avoids reintroducing typo mismatches", async () => {
    const anthropic = fakeAnthropic(
      vi.fn().mockResolvedValue('{"titles": ["Pourquoi les hommes ?"]}'),
    );
    const spotify = fakeSpotify({
      searchTrackByTitleAndArtist: vi
        .fn()
        .mockResolvedValue(track("Pourquoi les hommes?", "Vitaa")),
    });

    const result = await proposeCuratedTracksForArtist(
      anthropic,
      spotify,
      "Vitaa",
      "Variété actuelle",
      1,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ title: "Pourquoi les hommes?", artist: "Vitaa" });
  });

  it("returns an empty list when the AI response is malformed", async () => {
    const anthropic = fakeAnthropic(vi.fn().mockResolvedValue("not json"));
    const spotify = fakeSpotify();

    const result = await proposeCuratedTracksForArtist(anthropic, spotify, "Vitaa", "Rap FR", 3);

    expect(result).toEqual([]);
  });

  it("returns an empty list when the AI call itself fails", async () => {
    const anthropic = fakeAnthropic(vi.fn().mockRejectedValue(new Error("network error")));
    const spotify = fakeSpotify();

    const result = await proposeCuratedTracksForArtist(anthropic, spotify, "Vitaa", "Rap FR", 3);

    expect(result).toEqual([]);
  });

  it("never calls Spotify when the AI proposes no titles at all", async () => {
    const anthropic = fakeAnthropic(vi.fn().mockResolvedValue('{"titles": []}'));
    const searchTrackByTitleAndArtist = vi.fn();
    const spotify = fakeSpotify({ searchTrackByTitleAndArtist });

    const result = await proposeCuratedTracksForArtist(anthropic, spotify, "Vitaa", "Rap FR", 3);

    expect(result).toEqual([]);
    expect(searchTrackByTitleAndArtist).not.toHaveBeenCalled();
  });
});
