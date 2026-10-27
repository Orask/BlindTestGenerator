import type { ItunesClient } from "@blindtest/itunes";
import { describe, expect, it, vi } from "vitest";
import { hydrateShortTrack } from "./hydrate-track.js";

function fakeItunes(
  findPreviewByTitleAndArtist: ItunesClient["findPreviewByTitleAndArtist"],
): ItunesClient {
  return { findPreviewByTitleAndArtist };
}

describe("hydrateShortTrack", () => {
  it("skips a candidate with no album cover art without calling iTunes", async () => {
    // Spotify legitimately returns an empty `images` array for some
    // albums/compilations — see build-episode-tracks.ts's matching guard.
    const findPreview = vi
      .fn()
      .mockResolvedValue({ previewUrl: "https://preview.example.com/track.m4a" });
    const itunes = fakeItunes(findPreview);

    const result = await hydrateShortTrack(itunes, "Title", "Artist", "", 0);

    expect(result).toBeNull();
    expect(findPreview).not.toHaveBeenCalled();
  });

  it("hydrates a candidate that has album cover art", async () => {
    const findPreview = vi
      .fn()
      .mockResolvedValue({ previewUrl: "https://preview.example.com/track.m4a" });
    const itunes = fakeItunes(findPreview);

    const result = await hydrateShortTrack(
      itunes,
      "Title",
      "Artist",
      "https://cover.example.com/track.jpg",
      0,
    );

    expect(result).toEqual({
      title: "Title",
      artist: "Artist",
      albumCoverUrl: "https://cover.example.com/track.jpg",
      audioUrl: "https://preview.example.com/track.m4a",
    });
  });
});
