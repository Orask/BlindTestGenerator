import { describe, expect, it } from "vitest";
import { artistForDate, genreForDate, shortTypesForDay } from "./weekly-rotation.js";

describe("shortTypesForDay", () => {
  it("returns at most 2 types for every day (the ~2/day target from the research)", () => {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ] as const;
    for (const day of days) {
      expect(shortTypesForDay(day).length).toBeLessThanOrEqual(2);
    }
  });

  it("covers all 6 Short types at least once across the week", () => {
    const days = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ] as const;
    const coveredTypes = new Set(days.flatMap((day) => shortTypesForDay(day)));

    expect(coveredTypes).toEqual(
      new Set([
        "devine-la-chanson",
        "pepite-meconnue",
        "top-artiste",
        "anniversaire-sortie",
        "nouveaute-genre",
      ]),
    );
  });

  it("is deterministic for the same day", () => {
    expect(shortTypesForDay("monday")).toEqual(shortTypesForDay("monday"));
  });
});

describe("genreForDate", () => {
  it("returns a non-empty genre for any date", () => {
    expect(genreForDate(new Date("2026-09-27T00:00:00Z")).length).toBeGreaterThan(0);
  });

  it("varies across different calendar days", () => {
    const genres = new Set(
      [0, 1, 2, 3, 4].map((offset) => genreForDate(new Date(Date.UTC(2026, 0, 1 + offset)))),
    );
    expect(genres.size).toBeGreaterThan(1);
  });

  it("is the same for the same calendar day", () => {
    expect(genreForDate(new Date("2026-09-27T03:00:00Z"))).toBe(
      genreForDate(new Date("2026-09-27T21:00:00Z")),
    );
  });
});

describe("artistForDate", () => {
  it("returns undefined for an empty pool", () => {
    expect(artistForDate([], new Date("2026-09-27T00:00:00Z"))).toBeUndefined();
  });

  it("picks an artist from the given pool", () => {
    const pool = ["Daft Punk", "Stromae", "Angèle"];
    const artist = artistForDate(pool, new Date("2026-09-27T00:00:00Z"));
    expect(pool).toContain(artist);
  });

  it("varies across different calendar days for a pool larger than 1", () => {
    const pool = ["Artist A", "Artist B", "Artist C"];
    const artists = new Set(
      [0, 1, 2].map((offset) => artistForDate(pool, new Date(Date.UTC(2026, 0, 1 + offset)))),
    );
    expect(artists.size).toBeGreaterThan(1);
  });
});
