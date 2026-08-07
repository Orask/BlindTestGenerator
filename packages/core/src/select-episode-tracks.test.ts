import { describe, expect, it } from "vitest";
import { InsufficientTracksError, selectEpisodeTracks } from "./select-episode-tracks.js";
import type { Track } from "./types.js";

function track(id: string): Track {
  return {
    id,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    albumCoverUrl: `https://example.com/${id}.jpg`,
  };
}

describe("selectEpisodeTracks", () => {
  it("returns the first N candidates when none were used before", () => {
    const candidates = [track("1"), track("2"), track("3")];

    const result = selectEpisodeTracks(candidates, new Set(), 2);

    expect(result).toEqual([track("1"), track("2")]);
  });

  it("skips tracks already present in the channel history", () => {
    const candidates = [track("1"), track("2"), track("3")];

    const result = selectEpisodeTracks(candidates, new Set(["1"]), 2);

    expect(result).toEqual([track("2"), track("3")]);
  });

  it("de-duplicates repeated candidates", () => {
    const candidates = [track("1"), track("1"), track("2")];

    const result = selectEpisodeTracks(candidates, new Set(), 2);

    expect(result).toEqual([track("1"), track("2")]);
  });

  it("throws InsufficientTracksError when not enough fresh candidates remain", () => {
    const candidates = [track("1"), track("2")];

    expect(() => selectEpisodeTracks(candidates, new Set(["1"]), 2)).toThrow(
      InsufficientTracksError,
    );
  });
});
