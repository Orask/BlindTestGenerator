import type { Weekday } from "@blindtest/core";

export type ShortTypeId =
  | "devine-la-chanson"
  | "pepite-meconnue"
  | "top-artiste"
  | "anniversaire-sortie"
  | "nouveaute-genre";

// Volume (~2/day) still calibrated on the 2026 Shorts research
// (docs/CLOUD_SESSION_LOG.md, "Recherche stratégie Shorts 2026"): >5/day
// risks YouTube's spam-detection penalty, growth gains taper hard past
// ~3/day. But WHICH types fill those slots was rebalanced 2026-10-12 on
// real YouTube Analytics, not just research: nouveaute-genre ("traffic
// pur", not tied to any old episode) got 95-380 views, every Family A
// type (tied to an episode) got under 20 — confirmed live, not a guess.
// nouveaute-genre now runs every day; the other 4 types still each get at
// least one slot a week (keeps variety, see weekly-rotation.test.ts) but
// devine-la-chanson — the weakest even within Family A — is cut back to
// a single slot instead of three.
const WEEKLY_ROTATION: Record<Weekday, readonly ShortTypeId[]> = {
  monday: ["nouveaute-genre", "devine-la-chanson"],
  tuesday: ["nouveaute-genre", "pepite-meconnue"],
  wednesday: ["nouveaute-genre", "top-artiste"],
  thursday: ["nouveaute-genre", "pepite-meconnue"],
  friday: ["nouveaute-genre", "anniversaire-sortie"],
  saturday: ["nouveaute-genre", "top-artiste"],
  sunday: ["nouveaute-genre", "anniversaire-sortie"],
};

export function shortTypesForDay(day: Weekday): readonly ShortTypeId[] {
  return WEEKLY_ROTATION[day];
}

// A handful of broad, genuinely distinct genres — not tied to this
// channel's existing quiz themes, since Family B is explicitly meant to
// reach listeners the current theme roster doesn't (see
// docs/CLOUD_SESSION_LOG.md, famille B design constraints).
const GENRE_ROTATION = ["rap francais", "pop francaise", "house", "afrobeat"] as const;

function dayOfYear(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const startOfDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((startOfDay - startOfYear) / (24 * 60 * 60 * 1000));
}

/** Picks a different genre each calendar day so a weekly-recurring slot (e.g. every Monday) doesn't always search the exact same genre. */
export function genreForDate(date: Date): string {
  return GENRE_ROTATION[dayOfYear(date) % GENRE_ROTATION.length]!;
}

/** Picks a different seedArtists artist each calendar day from the channel's full (deduplicated) pool, so a weekly top-artiste slot doesn't always feature the same artist week after week. */
export function artistForDate(seedArtistPool: readonly string[], date: Date): string | undefined {
  if (seedArtistPool.length === 0) {
    return undefined;
  }
  return seedArtistPool[dayOfYear(date) % seedArtistPool.length];
}
