import { describe, expect, it } from "vitest";
import { resolveThemeForDay, weekdayFromDate } from "./theme-schedule.js";
import type { ChannelTheme } from "./channel-config.js";

describe("weekdayFromDate", () => {
  it("maps a known date to the correct weekday", () => {
    // 2026-08-07 is a Friday.
    expect(weekdayFromDate(new Date("2026-08-07T12:00:00Z"))).toBe("friday");
    // 2026-08-09 is a Sunday.
    expect(weekdayFromDate(new Date("2026-08-09T12:00:00Z"))).toBe("sunday");
  });
});

describe("resolveThemeForDay", () => {
  const themes: ChannelTheme[] = [
    {
      day: "monday",
      id: "annees-80",
      label: "Années 80",
      seedArtists: ["Jean-Jacques Goldman"],
      youtubePlaylistId: null,
    },
    {
      day: "friday",
      id: "variete-actuelle",
      label: "Variété actuelle",
      seedArtists: ["Angèle"],
      youtubePlaylistId: null,
    },
  ];

  it("returns the theme configured for the given day", () => {
    expect(resolveThemeForDay(themes, "friday").id).toBe("variete-actuelle");
  });

  it("throws when no theme is configured for the given day", () => {
    expect(() => resolveThemeForDay(themes, "sunday")).toThrow(/No theme configured/);
  });
});
