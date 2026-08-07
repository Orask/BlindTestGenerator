import type { ChannelTheme } from "@blindtest/core";
import { describe, expect, it } from "vitest";
import { buildYoutubeMetadata, type YoutubeMetadataTrack } from "./youtube-metadata.js";

const theme: ChannelTheme = {
  day: "monday",
  id: "annees-80",
  label: "Années 80",
  seedArtists: ["Jean-Jacques Goldman"],
  youtubePlaylistId: null,
};

const tracks: YoutubeMetadataTrack[] = [
  { title: "Dernière danse", artist: "Indila" },
  { title: "Papaoutai", artist: "Stromae" },
];

describe("buildYoutubeMetadata", () => {
  it("includes the theme label, track count and episode number in the title", () => {
    const metadata = buildYoutubeMetadata(theme, 12, tracks);

    expect(metadata.title).toBe(
      "BLIND TEST Années 80 🎧 | Devine 2 chansons en 12 secondes ! (Ép. 12)",
    );
  });

  it("builds a hashtag from the theme id without dashes", () => {
    const metadata = buildYoutubeMetadata(theme, 1, tracks);

    expect(metadata.description).toContain("#annees80");
  });

  it("includes the theme label among the tags", () => {
    const metadata = buildYoutubeMetadata(theme, 1, tracks);

    expect(metadata.tags).toContain("Années 80");
  });

  it("lists every track with its artist for attribution", () => {
    const metadata = buildYoutubeMetadata(theme, 1, tracks);

    expect(metadata.description).toContain("1. Dernière danse — Indila");
    expect(metadata.description).toContain("2. Papaoutai — Stromae");
  });
});
