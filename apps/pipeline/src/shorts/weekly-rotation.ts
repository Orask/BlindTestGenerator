import type { Weekday } from "@blindtest/core";

export type ShortTypeId =
  | "devine-la-chanson"
  | "pepite-meconnue"
  | "top-artiste"
  | "anniversaire-sortie"
  | "nouveaute-genre";

// Calibrated on the 2026 Shorts research (docs/CLOUD_SESSION_LOG.md,
// "Recherche stratégie Shorts 2026"), not an arbitrary number: >5/day risks
// YouTube's spam-detection penalty, growth gains taper hard past ~3/day,
// and posting quality/regularity beats raw volume above the minimum viable
// cadence. Decision for this project: ~2 Shorts/day on average, rotating
// the 6 types across the week instead of publishing every type every day
// (a day's actual count can come in lower — anniversaire-sortie/nouveaute-
// genre both skip gracefully when nothing qualifies, see
// generate-shorts-daily.ts — never higher).
const WEEKLY_ROTATION: Record<Weekday, readonly ShortTypeId[]> = {
  monday: ["devine-la-chanson", "nouveaute-genre"],
  tuesday: ["pepite-meconnue", "nouveaute-genre"],
  wednesday: ["devine-la-chanson", "top-artiste"],
  thursday: ["pepite-meconnue", "nouveaute-genre"],
  friday: ["devine-la-chanson", "anniversaire-sortie"],
  saturday: ["top-artiste", "nouveaute-genre"],
  sunday: ["pepite-meconnue", "anniversaire-sortie"],
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
