import type { ChannelTheme } from "@blindtest/core";
import { describe, expect, it } from "vitest";
import {
  buildAnniversaireSortieMetadata,
  buildPepiteMeconnueMetadata,
  buildShortMetadata,
  buildTopArtisteMetadata,
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

describe("buildPepiteMeconnueMetadata", () => {
  it("frames the title around the theme, not a countdown challenge", () => {
    const metadata = buildPepiteMeconnueMetadata(theme, tracks);

    expect(metadata.title).toBe("Tu connais ces pépites Années 80 ? 🎧 #Shorts");
  });

  it("lists every track in the description", () => {
    const metadata = buildPepiteMeconnueMetadata(theme, tracks);

    expect(metadata.description).toContain("Dernière danse — Indila");
    expect(metadata.description).toContain("Papaoutai — Stromae");
  });

  it("includes the theme hashtag and a pepite hashtag", () => {
    const metadata = buildPepiteMeconnueMetadata(theme, tracks);

    expect(metadata.description).toContain("#pepite");
    expect(metadata.description).toContain("#annees80");
  });
});

describe("buildTopArtisteMetadata", () => {
  it("includes the actual track count, not a fixed 'Top N' claim", () => {
    const metadata = buildTopArtisteMetadata("Daft Punk", tracks);

    expect(metadata.title).toBe("2 pépites de Daft Punk 🎧 #Shorts");
  });

  it("builds a hashtag from the artist name without punctuation", () => {
    const metadata = buildTopArtisteMetadata("Jean-Jacques Goldman", tracks);

    expect(metadata.description).toContain("#JeanJacquesGoldman");
  });

  it("lists every track in the description", () => {
    const metadata = buildTopArtisteMetadata("Daft Punk", tracks);

    expect(metadata.description).toContain("Dernière danse — Indila");
  });
});

describe("buildAnniversaireSortieMetadata", () => {
  it("includes the years-ago count and the track title in the title", () => {
    const metadata = buildAnniversaireSortieMetadata({
      title: "Papaoutai",
      artist: "Stromae",
      yearsAgo: 12,
    });

    expect(metadata.title).toBe('"Papaoutai" est sorti il y a 12 ans 🎂🎧 #Shorts');
  });

  it("mentions the artist and track in the description", () => {
    const metadata = buildAnniversaireSortieMetadata({
      title: "Papaoutai",
      artist: "Stromae",
      yearsAgo: 12,
    });

    expect(metadata.description).toContain("Stromae");
    expect(metadata.description).toContain("Papaoutai");
    expect(metadata.description).toContain("12 ans");
  });
});
