import type { ChannelConfig, ChannelTheme } from "@blindtest/core";
import { describe, expect, it } from "vitest";
import { findThemeOrThrow } from "./find-theme-by-id.js";

const annees80: ChannelTheme = {
  day: "monday",
  id: "annees-80",
  label: "Années 80",
  seedArtists: ["Jean-Jacques Goldman"],
  youtubePlaylistId: null,
};

const rapFr: ChannelTheme = {
  day: "thursday",
  id: "rap-fr",
  label: "Rap FR",
  seedArtists: ["Booba"],
  youtubePlaylistId: null,
};

const channel: ChannelConfig = {
  id: "blindtest-fr",
  name: "BlindTest FR",
  language: "fr",
  visibility: "private",
  publishHourLocal: 9,
  themes: [annees80, rapFr],
};

describe("findThemeOrThrow", () => {
  it("returns the theme whose id matches", () => {
    expect(findThemeOrThrow(channel, "rap-fr")).toBe(rapFr);
  });

  it("throws a descriptive error when no theme matches", () => {
    expect(() => findThemeOrThrow(channel, "generiques")).toThrow(
      "Theme generiques not found in channel config",
    );
  });
});
