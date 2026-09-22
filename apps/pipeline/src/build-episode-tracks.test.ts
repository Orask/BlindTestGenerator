import { InsufficientTracksError, type Track } from "@blindtest/core";
import type { ItunesClient } from "@blindtest/itunes";
import { describe, expect, it, vi } from "vitest";
import { buildEpisodeTracks } from "./build-episode-tracks.js";

function track(id: string, popularityRank = 1, artistNames = [`Artist ${id}`]): Track {
  return {
    id,
    title: `Title ${id}`,
    artist: artistNames.join(", "),
    artistNames,
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
    const sameArtist = (id: string): Track => track(id, 1, ["Overexposed Artist"]);
    const candidates = [sameArtist("1"), sameArtist("2"), sameArtist("3"), track("4")];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(),
      new Set(),
      itunesThatFindsAllPreviews(),
      3,
      0,
    );

    const overexposedCount = result.filter((t) =>
      t.artistNames.includes("Overexposed Artist"),
    ).length;
    expect(overexposedCount).toBe(2);
    expect(result).toHaveLength(3);
  });

  it("never picks more than 2 tracks featuring the same artist, even under different collab credits", async () => {
    // Reproduces the real bug: a featured artist credited alongside a
    // different collaborator on every track never repeats as an exact
    // joined "artist" string, so a naive string-based cap let them appear
    // on every single track of the episode.
    const candidates = [
      track("1", 1, ["Mortelle Adèle", "Dorothée Pousséo"]),
      track("2", 1, ["Dorothée Pousséo", "Aldebert"]),
      track("3", 1, ["Petit Ours Brun", "Dorothée Pousséo"]),
      track("4", 1, ["Chantal Goya"]),
      track("5", 1, ["Henri Dès"]),
    ];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(),
      new Set(),
      itunesThatFindsAllPreviews(),
      3,
      0,
    );

    const featuringDorothee = result.filter((t) => t.artistNames.includes("Dorothée Pousséo"));
    expect(featuringDorothee).toHaveLength(2);
  });

  it("never places two tracks from the same artist back-to-back", async () => {
    const sameArtist = (id: string): Track => track(id, 1, ["Overexposed Artist"]);
    const candidates = [sameArtist("1"), sameArtist("2"), track("3"), track("4")];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(),
      new Set(),
      itunesThatFindsAllPreviews(),
      4,
      0,
    );

    const adjacentDuplicate = result.some(
      (t, i) => i > 0 && result[i - 1]!.artistNames.some((name) => t.artistNames.includes(name)),
    );
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

  it("grants a mainstream artist a 3rd (bonus) track when still short after fresh + reuse passes", async () => {
    // 9 distinct solo artists, one ("Big Artist") with a much deeper
    // catalog in the raw candidate pool than the rest — the proxy for
    // "mainstream" this pass uses. The 8 solo artists only supply 1 track
    // each, so the normal 2-cap fresh pass tops out at 10 (2 + 8); needing
    // 11 forces the bonus pass to draw a 3rd track from "Big Artist".
    const candidates = [
      ...Array.from({ length: 6 }, (_, i) => track(`big-${i}`, i, ["Big Artist"])),
      ...Array.from({ length: 8 }, (_, i) => track(`solo-${i}`, 0, [`Solo Artist ${i}`])),
    ];

    const result = await buildEpisodeTracks(
      candidates,
      new Set(),
      new Set(),
      itunesThatFindsAllPreviews(),
      11,
      0,
    );

    expect(result).toHaveLength(11);
    const bigArtistCount = result.filter((t) => t.artistNames.includes("Big Artist")).length;
    expect(bigArtistCount).toBe(3);
  });

  it("never grants a bonus 3rd track to more than ~10% of the episode's artists", async () => {
    // 10 distinct artists, each with equal catalog depth (3 tracks) — the
    // normal 2-cap fresh pass tops out at 20, and at most ceil(10% * 10) =
    // 1 artist may get a bonus 3rd track, so needing 22 should still fail.
    const candidates = Array.from({ length: 10 }, (_, artistIdx) =>
      Array.from({ length: 3 }, (_, trackIdx) =>
        track(`a${artistIdx}-${trackIdx}`, 0, [`Artist ${artistIdx}`]),
      ),
    ).flat();

    await expect(
      buildEpisodeTracks(candidates, new Set(), new Set(), itunesThatFindsAllPreviews(), 22, 0),
    ).rejects.toThrow(InsufficientTracksError);
  });

  it("never grants a bonus track to a collab (multi-artist) credit", async () => {
    const candidates = [
      track("1", 0, ["Big Artist"]),
      track("2", 1, ["Big Artist"]),
      track("3", 2, ["Big Artist", "Featured"]), // would be the 3rd Big Artist track, but is a collab
    ];

    await expect(
      buildEpisodeTracks(candidates, new Set(), new Set(), itunesThatFindsAllPreviews(), 3, 0),
    ).rejects.toThrow(InsufficientTracksError);
  });

  it("never uses the bonus pass to reuse a track (fresh candidates only)", async () => {
    const candidates = [
      track("1", 0, ["Big Artist"]),
      track("2", 1, ["Big Artist"]),
      track("3", 2, ["Big Artist"]),
    ];

    await expect(
      buildEpisodeTracks(
        candidates,
        new Set(),
        new Set(["3"]), // past cooldown, would otherwise be eligible for the bonus slot
        itunesThatFindsAllPreviews(),
        3,
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
