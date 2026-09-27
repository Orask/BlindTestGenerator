import type { ChannelTheme } from "@blindtest/core";
import { describe, expect, it } from "vitest";
import {
  buildShortMetadata,
  buildYoutubeMetadata,
  type YoutubeMetadataTrack,
} from "./youtube-metadata.js";

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

describe("buildShortMetadata", () => {
  it("includes the theme label, short track count and #Shorts in the title", () => {
    const metadata = buildShortMetadata(theme, 12, 5, 40);

    expect(metadata.title).toBe("5 extraits Années 80 en 12s chrono 🎧 #Shorts");
  });

  it("points the description at the full episode, not the short's own track count", () => {
    const metadata = buildShortMetadata(theme, 12, 5, 40);

    expect(metadata.description).toContain('épisode "Années 80" (Ép. 12)');
    expect(metadata.description).toContain("40 morceaux à deviner en entier");
  });

  it("includes the #shorts hashtag alongside the theme hashtag", () => {
    const metadata = buildShortMetadata(theme, 1, 5, 40);

    expect(metadata.description).toContain("#shorts");
    expect(metadata.description).toContain("#annees80");
  });
});
