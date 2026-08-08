import { describe, expect, it } from "vitest";
import { buildOpeningHook } from "./opening-hook.js";

function track(
  artistNames: readonly string[],
  n: number,
  popularityRank: number | undefined = undefined,
): { artistNames: readonly string[]; title: string; popularityRank: number | undefined } {
  return { artistNames, title: `${artistNames.join(", ")} track ${n}`, popularityRank };
}

function hasAdjacentArtistOverlap(tracks: readonly { artistNames: readonly string[] }[]): boolean {
  return tracks.some((t, i) => {
    if (i === 0) {
      return false;
    }
    const previous = tracks[i - 1]!;
    return t.artistNames.some((name) => previous.artistNames.includes(name));
  });
}

describe("buildOpeningHook", () => {
  it("keeps every track, just reordered", () => {
    const tracks = [track(["A"], 1, 0), track(["A"], 2, 1), track(["B"], 1, 0), track(["C"], 1, 1)];

    const result = buildOpeningHook(tracks, 5);

    expect(result).toHaveLength(4);
    expect(result).toEqual(expect.arrayContaining(tracks));
  });

  it("puts each artist's rank-0 track first, up to hookSize", () => {
    const tracks = [
      track(["A"], 1, 1),
      track(["A"], 2, 0),
      track(["B"], 1, 1),
      track(["B"], 2, 0),
      track(["C"], 1, 0),
      track(["D"], 1, 1),
    ];

    const result = buildOpeningHook(tracks, 2);

    const openingArtists = new Set(result.slice(0, 2).flatMap((t) => t.artistNames));
    expect(result.slice(0, 2).every((t) => t.popularityRank === 0)).toBe(true);
    expect(openingArtists.size).toBe(2);
  });

  it("falls back to the full remainder when there are no signature tracks", () => {
    const tracks = [track(["A"], 1, 1), track(["B"], 1, 2), track(["C"], 1, 3)];

    const result = buildOpeningHook(tracks, 5);

    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining(tracks));
  });

  it("never places two tracks with an overlapping artist adjacently, even across a collab", () => {
    const tracks = [
      track(["A"], 1, 0),
      track(["A", "X"], 2, 1),
      track(["B"], 1, 0),
      track(["B", "X"], 2, 1),
      track(["C"], 1, 0),
      track(["C"], 2, 1),
      track(["D"], 1, 1),
    ];

    const result = buildOpeningHook(tracks, 3);

    expect(hasAdjacentArtistOverlap(result)).toBe(false);
  });

  it("takes fewer than hookSize tracks when not enough signature tracks exist", () => {
    const tracks = [track(["A"], 1, 0), track(["B"], 1, 1), track(["C"], 1, 1)];

    const result = buildOpeningHook(tracks, 5);

    expect(result[0]!.popularityRank).toBe(0);
    expect(result).toHaveLength(3);
  });
});
