import type { SpotifyClient, SpotifyTrackMetadata } from "@blindtest/spotify";
import { describe, expect, it, vi } from "vitest";
import { verifyCuratedSongs } from "./verify-curated-songs.js";

function fakeTrack(overrides: Partial<SpotifyTrackMetadata> = {}): SpotifyTrackMetadata {
  return {
    id: "id-1",
    title: "Dernière danse",
    artist: "Indila",
    artistNames: ["Indila"],
    albumCoverUrl: "",
    popularityRank: 0,
    ...overrides,
  };
}

function fakeSpotify(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn(),
    getTrackById: vi.fn(),
    searchArtists: vi.fn(),
    searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(fakeTrack()),
    ...overrides,
  };
}

describe("verifyCuratedSongs", () => {
  it("accepts every song that Spotify confirms as an exact match", async () => {
    const spotify = fakeSpotify({
      searchTrackByTitleAndArtist: vi
        .fn()
        .mockResolvedValueOnce(fakeTrack({ id: "1", title: "Dernière danse" }))
        .mockResolvedValueOnce(fakeTrack({ id: "2", title: "Tourner dans le vide" })),
    });

    const result = await verifyCuratedSongs(
      spotify,
      { Indila: ["Dernière danse", "Tourner dans le vide"] },
      0,
    );

    expect(result.verified).toEqual([
      { artist: "Indila", title: "Dernière danse", spotifyTrackId: "1" },
      { artist: "Indila", title: "Tourner dans le vide", spotifyTrackId: "2" },
    ]);
    expect(result.rejected).toEqual([]);
  });

  it("rejects a song Spotify can't confirm, without throwing", async () => {
    const spotify = fakeSpotify({
      searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(null),
    });

    const result = await verifyCuratedSongs(spotify, { Indila: ["Chanson Imaginaire"] }, 0);

    expect(result.verified).toEqual([]);
    expect(result.rejected).toEqual([{ artist: "Indila", title: "Chanson Imaginaire" }]);
  });

  it("checks every artist and every title in the input", async () => {
    const searchTrackByTitleAndArtist = vi.fn().mockResolvedValue(fakeTrack());
    const spotify = fakeSpotify({ searchTrackByTitleAndArtist });

    await verifyCuratedSongs(spotify, { A: ["Song 1", "Song 2"], B: ["Song 3"] }, 0);

    expect(searchTrackByTitleAndArtist).toHaveBeenCalledTimes(3);
    expect(searchTrackByTitleAndArtist).toHaveBeenCalledWith("Song 1", "A");
    expect(searchTrackByTitleAndArtist).toHaveBeenCalledWith("Song 2", "A");
    expect(searchTrackByTitleAndArtist).toHaveBeenCalledWith("Song 3", "B");
  });

  it("returns empty results for empty input", async () => {
    const spotify = fakeSpotify();

    const result = await verifyCuratedSongs(spotify, {}, 0);

    expect(result).toEqual({ verified: [], rejected: [] });
  });

  it("records a lookup failure as rejected instead of throwing, and keeps going", async () => {
    const spotify = fakeSpotify({
      searchTrackByTitleAndArtist: vi
        .fn()
        .mockRejectedValueOnce(new Error("429 quota exceeded"))
        .mockResolvedValueOnce(fakeTrack({ id: "2", title: "Song 2" })),
    });

    const result = await verifyCuratedSongs(spotify, { A: ["Song 1", "Song 2"] }, 0);

    expect(result.verified).toEqual([{ artist: "A", title: "Song 2", spotifyTrackId: "2" }]);
    expect(result.rejected).toEqual([
      { artist: "A", title: "Song 1", error: "429 quota exceeded" },
    ]);
  });

  it("reports progress after every song, with a running done/total count", async () => {
    const spotify = fakeSpotify();
    const onProgress = vi.fn();

    await verifyCuratedSongs(spotify, { A: ["Song 1", "Song 2"] }, 0, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, expect.objectContaining({ done: 1, total: 2 }));
    expect(onProgress).toHaveBeenNthCalledWith(2, expect.objectContaining({ done: 2, total: 2 }));
  });

  it("reports which song was just processed and whether it was verified or rejected", async () => {
    const spotify = fakeSpotify({
      searchTrackByTitleAndArtist: vi
        .fn()
        .mockResolvedValueOnce(fakeTrack({ id: "1", title: "Song 1" }))
        .mockResolvedValueOnce(null),
    });
    const onProgress = vi.fn();

    await verifyCuratedSongs(spotify, { A: ["Song 1", "Song 2"] }, 0, onProgress);

    expect(onProgress).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        lastOutcome: "verified",
        last: { artist: "A", title: "Song 1", spotifyTrackId: "1" },
      }),
    );
    expect(onProgress).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        lastOutcome: "rejected",
        last: { artist: "A", title: "Song 2" },
      }),
    );
  });

  it("awaits an async progress callback before moving to the next song", async () => {
    const spotify = fakeSpotify();
    const order: string[] = [];
    const onProgress = vi.fn().mockImplementation(async ({ done }: { done: number }) => {
      order.push(`progress-${done}-start`);
      await Promise.resolve();
      order.push(`progress-${done}-end`);
    });

    await verifyCuratedSongs(spotify, { A: ["Song 1", "Song 2"] }, 0, onProgress);

    expect(order).toEqual([
      "progress-1-start",
      "progress-1-end",
      "progress-2-start",
      "progress-2-end",
    ]);
  });
});
