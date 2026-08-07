import { describe, expect, it } from "vitest";
import { spreadOutArtists } from "./diversify-artists.js";

function trackOf(artist: string, n: number): { artist: string; title: string } {
  return { artist, title: `${artist} track ${n}` };
}

function hasAdjacentDuplicateArtist(tracks: readonly { artist: string }[]): boolean {
  return tracks.some((track, i) => i > 0 && tracks[i - 1]!.artist === track.artist);
}

describe("spreadOutArtists", () => {
  it("keeps every track, just reordered", () => {
    const tracks = [trackOf("A", 1), trackOf("A", 2), trackOf("B", 1)];

    const result = spreadOutArtists(tracks);

    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining(tracks));
  });

  it("separates two tracks from the same artist that started adjacent", () => {
    const tracks = [trackOf("A", 1), trackOf("A", 2), trackOf("B", 1), trackOf("C", 1)];

    const result = spreadOutArtists(tracks);

    expect(hasAdjacentDuplicateArtist(result)).toBe(false);
  });

  it("handles a larger mix without adjacent duplicates", () => {
    const tracks = [
      trackOf("A", 1),
      trackOf("A", 2),
      trackOf("B", 1),
      trackOf("B", 2),
      trackOf("C", 1),
      trackOf("C", 2),
      trackOf("D", 1),
    ];

    const result = spreadOutArtists(tracks);

    expect(result).toHaveLength(tracks.length);
    expect(hasAdjacentDuplicateArtist(result)).toBe(false);
  });

  it("leaves a single track or single-artist input untouched", () => {
    expect(spreadOutArtists([trackOf("A", 1)])).toEqual([trackOf("A", 1)]);
  });
});
