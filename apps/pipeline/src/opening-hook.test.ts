import { describe, expect, it } from "vitest";
import { buildOpeningHook } from "./opening-hook.js";

function track(
  artist: string,
  n: number,
  popularityRank: number | undefined = undefined,
): { artist: string; title: string; popularityRank: number | undefined } {
  return { artist, title: `${artist} track ${n}`, popularityRank };
}

function hasAdjacentDuplicateArtist(tracks: readonly { artist: string }[]): boolean {
  return tracks.some((t, i) => i > 0 && tracks[i - 1]!.artist === t.artist);
}

describe("buildOpeningHook", () => {
  it("keeps every track, just reordered", () => {
    const tracks = [track("A", 1, 0), track("A", 2, 1), track("B", 1, 0), track("C", 1, 1)];

    const result = buildOpeningHook(tracks, 5);

    expect(result).toHaveLength(4);
    expect(result).toEqual(expect.arrayContaining(tracks));
  });

  it("puts each artist's rank-0 track first, up to hookSize", () => {
    const tracks = [
      track("A", 1, 1),
      track("A", 2, 0),
      track("B", 1, 1),
      track("B", 2, 0),
      track("C", 1, 0),
      track("D", 1, 1),
    ];

    const result = buildOpeningHook(tracks, 2);

    const openingArtists = new Set(result.slice(0, 2).map((t) => t.artist));
    expect(result.slice(0, 2).every((t) => t.popularityRank === 0)).toBe(true);
    expect(openingArtists.size).toBe(2);
  });

  it("falls back to the full remainder when there are no signature tracks", () => {
    const tracks = [track("A", 1, 1), track("B", 1, 2), track("C", 1, 3)];

    const result = buildOpeningHook(tracks, 5);

    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining(tracks));
  });

  it("never places two tracks from the same artist adjacently", () => {
    const tracks = [
      track("A", 1, 0),
      track("A", 2, 1),
      track("B", 1, 0),
      track("B", 2, 1),
      track("C", 1, 0),
      track("C", 2, 1),
      track("D", 1, 1),
    ];

    const result = buildOpeningHook(tracks, 3);

    expect(hasAdjacentDuplicateArtist(result)).toBe(false);
  });

  it("takes fewer than hookSize tracks when not enough signature tracks exist", () => {
    const tracks = [track("A", 1, 0), track("B", 1, 1), track("C", 1, 1)];

    const result = buildOpeningHook(tracks, 5);

    expect(result[0]!.popularityRank).toBe(0);
    expect(result).toHaveLength(3);
  });
});
