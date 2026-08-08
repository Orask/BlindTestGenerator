import { describe, expect, it } from "vitest";
import {
  nextOccurrenceOf,
  nextPublishDateTime,
  resolveThemeForDay,
  weekdayFromDate,
} from "./theme-schedule.js";
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

describe("nextOccurrenceOf", () => {
  it("finds the same weekday next week when it's today", () => {
    // 2026-08-08 is a Saturday.
    const from = new Date("2026-08-08T12:00:00Z");
    expect(nextOccurrenceOf("saturday", from).toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("finds the closest future occurrence within the next 7 days", () => {
    // 2026-08-08 is a Saturday; Monday is 2 days out.
    const from = new Date("2026-08-08T12:00:00Z");
    expect(nextOccurrenceOf("monday", from).toISOString().slice(0, 10)).toBe("2026-08-10");
  });

  it("never returns today or a past date", () => {
    const from = new Date("2026-08-08T12:00:00Z");
    for (const day of [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ] as const) {
      expect(nextOccurrenceOf(day, from).getTime()).toBeGreaterThan(from.getTime());
    }
  });
});

describe("nextPublishDateTime", () => {
  it("combines the next occurrence with a local hour", () => {
    const from = new Date("2026-08-08T12:00:00Z");
    const result = nextPublishDateTime("monday", from, 9);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(10);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });
});
