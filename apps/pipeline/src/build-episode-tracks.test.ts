import { InsufficientTracksError, type Track } from "@blindtest/core";
import type { ItunesClient } from "@blindtest/itunes";
import { describe, expect, it, vi } from "vitest";
import { buildEpisodeTracks } from "./build-episode-tracks.js";

function track(id: string, popularityRank = 1): Track {
  return {
    id,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    albumCoverUrl: `https://example.com/${id}.jpg`,
    popularityRank,
  };
}

function itunesThatFindsAllPreviews(): ItunesClient {
  return {
    findPreviewByTitleAndArtist: vi
      .fn()
      .mockImplementation((title: string) =>
        Promise.resolve({ previewUrl: `https://preview.example.com/${title}.m4a` }),
      ),
  };
}

describe("buildEpisodeTracks", () => {
  it("resolves audio for the requested number of fresh tracks", async () => {
    const candidates = [track("1"), track("2"), track("3")];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(),
      new Set(),
      itunesThatFindsAllPreviews(),
      2,
      0,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: "1", audioUrl: expect.stringContaining("Title 1") });
  });

  it("skips tracks used within the cooldown window", async () => {
    const candidates = [track("1"), track("2"), track("3")];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(["1"]),
      new Set(["1"]),
      itunesThatFindsAllPreviews(),
      2,
      0,
    );

    expect(result.map((t) => t.id)).toEqual(["2", "3"]);
  });

  it("skips a candidate with no available preview and moves to the next one", async () => {
    const itunes: ItunesClient = {
      findPreviewByTitleAndArtist: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ previewUrl: "https://preview.example.com/2.m4a" }),
    };

    const result = await buildEpisodeTracks(
      [track("1"), track("2")],
      new Set(),
      new Set(),
      itunes,
      1,
      0,
    );

    expect(result).toEqual([{ ...track("2"), audioUrl: "https://preview.example.com/2.m4a" }]);
  });

  it("throws InsufficientTracksError when not enough tracks resolve an audio preview", async () => {
    const itunes: ItunesClient = { findPreviewByTitleAndArtist: vi.fn().mockResolvedValue(null) };

    await expect(
      buildEpisodeTracks([track("1"), track("2")], new Set(), new Set(), itunes, 2, 0),
    ).rejects.toThrow(InsufficientTracksError);
  });

  it("never picks more than 2 tracks from the same artist, even with more candidates available", async () => {
    const sameArtist = (id: string): Track => ({ ...track(id), artist: "Overexposed Artist" });
    const candidates = [sameArtist("1"), sameArtist("2"), sameArtist("3"), track("4")];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(),
      new Set(),
      itunesThatFindsAllPreviews(),
      3,
      0,
    );

    const overexposedCount = result.filter((t) => t.artist === "Overexposed Artist").length;
    expect(overexposedCount).toBe(2);
    expect(result).toHaveLength(3);
  });

  it("never places two tracks from the same artist back-to-back", async () => {
    const sameArtist = (id: string): Track => ({ ...track(id), artist: "Overexposed Artist" });
    const candidates = [sameArtist("1"), sameArtist("2"), track("3"), track("4")];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(),
      new Set(),
      itunesThatFindsAllPreviews(),
      4,
      0,
    );

    const adjacentDuplicate = result.some((t, i) => i > 0 && result[i - 1]!.artist === t.artist);
    expect(adjacentDuplicate).toBe(false);
  });

  it("puts each artist's rank-0 track first (the opening hook)", async () => {
    const candidates = [track("1", 1), track("2", 0), track("3", 1), track("4", 0), track("5", 1)];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(),
      new Set(),
      itunesThatFindsAllPreviews(),
      5,
      0,
    );

    expect(result[0]!.popularityRank).toBe(0);
    expect(result[1]!.popularityRank).toBe(0);
  });

  it("falls back to reusing a track past its cooldown when fresh candidates run out", async () => {
    const candidates = [track("1"), track("2")];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(), // nothing in the cooldown window
      new Set(["2"]), // "2" was used before, but the cooldown has passed
      itunesThatFindsAllPreviews(),
      2,
      0,
    );

    expect(result.map((t) => t.id).sort()).toEqual(["1", "2"]);
  });

  it("never reuses more than the per-episode cap, even if more stale candidates exist", async () => {
    const candidates = [track("1"), track("2"), track("3")];

    await expect(
      buildEpisodeTracks(
        candidates,
        new Set(),
        new Set(["1", "2", "3"]), // all previously used, all past cooldown
        itunesThatFindsAllPreviews(),
        3, // needs 3, but only 2 reuses are allowed per episode
        0,
      ),
    ).rejects.toThrow(InsufficientTracksError);
  });

  it("never reuses a track still inside the cooldown window, even as a last resort", async () => {
    const candidates = [track("1")];

    await expect(
      buildEpisodeTracks(
        candidates,
        new Set(["1"]), // inside cooldown
        new Set(["1"]),
        itunesThatFindsAllPreviews(),
        1,
        0,
      ),
    ).rejects.toThrow(InsufficientTracksError);
  });
});
