import { describe, expect, it } from "vitest";
import { spreadOutArtists } from "./diversify-artists.js";

function trackOf(
  artistNames: readonly string[],
  n: number,
): { artistNames: readonly string[]; title: string } {
  return { artistNames, title: `${artistNames.join(", ")} track ${n}` };
}

function hasAdjacentArtistOverlap(tracks: readonly { artistNames: readonly string[] }[]): boolean {
  return tracks.some((track, i) => {
    if (i === 0) {
      return false;
    }
    const previous = tracks[i - 1]!;
    return track.artistNames.some((name) => previous.artistNames.includes(name));
  });
}

describe("spreadOutArtists", () => {
  it("keeps every track, just reordered", () => {
    const tracks = [trackOf(["A"], 1), trackOf(["A"], 2), trackOf(["B"], 1)];

    const result = spreadOutArtists(tracks);

    expect(result).toHaveLength(3);
    expect(result).toEqual(expect.arrayContaining(tracks));
  });

  it("separates two tracks from the same artist that started adjacent", () => {
    const tracks = [trackOf(["A"], 1), trackOf(["A"], 2), trackOf(["B"], 1), trackOf(["C"], 1)];

    const result = spreadOutArtists(tracks);

    expect(hasAdjacentArtistOverlap(result)).toBe(false);
  });

  it("handles a larger mix without adjacent duplicates", () => {
    const tracks = [
      trackOf(["A"], 1),
      trackOf(["A"], 2),
      trackOf(["B"], 1),
      trackOf(["B"], 2),
      trackOf(["C"], 1),
      trackOf(["C"], 2),
      trackOf(["D"], 1),
    ];

    const result = spreadOutArtists(tracks);

    expect(result).toHaveLength(tracks.length);
    expect(hasAdjacentArtistOverlap(result)).toBe(false);
  });

  it("leaves a single track or single-artist input untouched", () => {
    expect(spreadOutArtists([trackOf(["A"], 1)])).toEqual([trackOf(["A"], 1)]);
  });

  it("never places two tracks adjacently when they share a featured artist, even under different credit strings", () => {
    // Reproduces the real bug: three tracks whose joined "artist" strings
    // are all different, but the same person ("Dorothée Pousséo") is
    // credited on every one of them — a naive string-equality bucket would
    // treat these as three unrelated artists and happily place them
    // back-to-back.
    const tracks = [
      trackOf(["Mortelle Adèle", "Dorothée Pousséo"], 1),
      trackOf(["Dorothée Pousséo", "Aldebert"], 2),
      trackOf(["Mortelle Adèle", "Dorothée Pousséo"], 3),
      trackOf(["Petit Ours Brun", "Dorothée Pousséo"], 4),
      trackOf(["Chantal Goya"], 5),
      trackOf(["Henri Dès"], 6),
      trackOf(["Anne Sylvestre"], 7),
    ];

    const result = spreadOutArtists(tracks);

    expect(result).toHaveLength(tracks.length);
    expect(hasAdjacentArtistOverlap(result)).toBe(false);
  });
});
