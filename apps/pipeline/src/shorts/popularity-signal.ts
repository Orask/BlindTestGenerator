import type { DeezerClient } from "@blindtest/deezer";

// Deezer's documented rate limit is ~50 requests/5s (~10/s) — far more
// generous than iTunes' unofficial ~20/min already paced elsewhere in this
// project (see hydrate-track.ts). No auth/quota to protect either way, but
// staying well under the documented limit is still the polite default.
const DEEZER_LOOKUP_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The one step every Family A selector needs to score a candidate's
 * notoriety, now that Spotify's own `popularity` field is gone (removed by
 * Spotify's February 2026 changelog — see docs/CLOUD_SESSION_LOG.md).
 * Deezer's `rank` (0 to ~1,000,000, comparable across artists/eras) is the
 * closest free, keyless replacement.
 *
 * A track Deezer has no confident match for scores 0 — the LOWEST possible
 * value, never skipped and never treated as neutral. This signal only ever
 * ranks candidates relative to each other (see docs/CLOUD_SESSION_LOG.md —
 * the explicit goal is "known enough to keep viewers watching", not an
 * exact ranking), so a track Deezer doesn't recognize is safest to assume
 * is not a widely-known one, rather than guessing it's average.
 *
 * Callers pass their own `lookupDelayMs` straight through as `delayMs` —
 * the same override each selector already accepts for iTunes pacing (see
 * hydrate-track.ts): `undefined` falls back to the default above in
 * production, tests pass `0` to run instantly.
 */
export async function popularitySignal(
  deezer: DeezerClient,
  title: string,
  artist: string,
  delayMs: number = DEEZER_LOOKUP_DELAY_MS,
): Promise<number> {
  const rank = await deezer.getTrackPopularityRank(title, artist);
  await sleep(delayMs);
  return rank ?? 0;
}
