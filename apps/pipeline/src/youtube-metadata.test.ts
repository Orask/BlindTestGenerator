import type { ChannelTheme } from "@blindtest/core";
import { describe, expect, it } from "vitest";
import { buildYoutubeMetadata } from "./youtube-metadata.js";

const theme: ChannelTheme = {
  day: "monday",
  id: "annees-80",
  label: "Années 80",
  seedArtists: ["Jean-Jacques Goldman"],
  youtubePlaylistId: null,
};

describe("buildYoutubeMetadata", () => {
  it("includes the theme label and episode number in the title", () => {
    const metadata = buildYoutubeMetadata(theme, 12);

    expect(metadata.title).toBe(
      "BLIND TEST Années 80 🎧 | Devine 40 chansons en 10 secondes ! (Ép. 12)",
    );
  });

  it("builds a hashtag from the theme id without dashes", () => {
    const metadata = buildYoutubeMetadata(theme, 1);

    expect(metadata.description).toContain("#annees80");
  });

  it("includes the theme label among the tags", () => {
    const metadata = buildYoutubeMetadata(theme, 1);

    expect(metadata.tags).toContain("Années 80");
  });
});
