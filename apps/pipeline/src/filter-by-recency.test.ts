import type { ChannelTheme, Track } from "@blindtest/core";
import { describe, expect, it } from "vitest";
import { filterByRecency } from "./filter-by-recency.js";

function track(id: string, releaseDate: string | undefined): Track {
  return {
    id,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    artistNames: [`Artist ${id}`],
    albumCoverUrl: "",
    ...(releaseDate !== undefined ? { releaseDate } : {}),
  };
}

function theme(overrides: Partial<ChannelTheme> = {}): ChannelTheme {
  return {
    day: "monday",
    id: "test-theme",
    label: "Test",
    seedArtists: ["Someone"],
    youtubePlaylistId: null,
    ...overrides,
  };
}

describe("filterByRecency", () => {
  it("returns every candidate unchanged when the theme has neither bound configured", () => {
    const candidates = [track("1", "1985-01-01"), track("2", "2024-06-01")];

    const result = filterByRecency(candidates, theme());

    expect(result).toEqual(candidates);
  });

  it("keeps only tracks within an absolute releaseYearRange (decade theme)", () => {
    const candidates = [
      track("old", "1975-01-01"),
      track("in-range", "1985-06-01"),
      track("new", "2020-01-01"),
    ];

    const result = filterByRecency(
      candidates,
      theme({ releaseYearRange: { min: 1980, max: 1989 } }),
    );

    expect(result.map((t) => t.id)).toEqual(["in-range"]);
  });

  it("supports a one-sided releaseYearRange (min only, or max only)", () => {
    const candidates = [track("old", "1975-01-01"), track("new", "2020-01-01")];

    expect(filterByRecency(candidates, theme({ releaseYearRange: { min: 2000 } }))).toEqual([
      candidates[1],
    ]);
    expect(filterByRecency(candidates, theme({ releaseYearRange: { max: 2000 } }))).toEqual([
      candidates[0],
    ]);
  });

  it("keeps only tracks within the rolling recencyWindowYears (genre theme)", () => {
    const now = new Date("2026-10-12T00:00:00Z");
    const candidates = [
      track("too-old", "2010-01-01"),
      track("recent", "2020-01-01"),
      track("brand-new", "2026-01-01"),
    ];

    const result = filterByRecency(candidates, theme({ recencyWindowYears: 10 }), now);

    expect(result.map((t) => t.id)).toEqual(["recent", "brand-new"]);
  });

  it("keeps a candidate with no parseable release date rather than dropping it", () => {
    const candidates = [track("unknown", undefined), track("old", "1975-01-01")];

    const result = filterByRecency(candidates, theme({ releaseYearRange: { min: 2000 } }));

    expect(result.map((t) => t.id)).toEqual(["unknown"]);
  });

  it("parses year-only and year-month release date precisions the same as a full date", () => {
    const candidates = [track("year-only", "1986"), track("year-month", "1986-03")];

    const result = filterByRecency(
      candidates,
      theme({ releaseYearRange: { min: 1980, max: 1989 } }),
    );

    expect(result).toEqual(candidates);
  });
});
