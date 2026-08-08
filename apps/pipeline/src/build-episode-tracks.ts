import { InsufficientTracksError, type Track } from "@blindtest/core";
import type { ItunesClient } from "@blindtest/itunes";
import { buildOpeningHook } from "./opening-hook.js";

export interface EpisodeTrack extends Track {
  readonly audioUrl: string;
}

const MAX_TRACKS_PER_ARTIST = 2;
const OPENING_HOOK_SIZE = 5;

// A theme's seed-artist pool is finite and fixed, so a strict "never repeat,
// ever" rule eventually starves a weekly-recurring theme once its pool is
// exhausted. Reuse is allowed instead, but only once REUSE_COOLDOWN_DAYS has
// passed since a track's last use, and capped low per episode — variety
// matters more than avoiding reuse altogether.
export const REUSE_COOLDOWN_DAYS = 14;
const MAX_REPEATED_TRACKS_PER_EPISODE = 2;

// iTunes Search's unofficial limit is ~20 requests/minute per IP (confirmed
// live: 200ms spacing — ~300/min — reliably tripped a sustained block after
// a few dozen calls that even 8 retries with backoff couldn't outlast).
// 3.5s keeps us under that with margin; a full 60-track episode can need
// ~150-200 lookups, so this adds several minutes, which is fine for a
// once-a-day background job.
const ITUNES_LOOKUP_DELAY_MS = 3500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Applies anti-repeat + de-duplication, audio resolution, and a per-artist
 * cap in a single pass, since a track only "counts" once we know a preview
 * is actually available for it — skipping straight to the next candidate is
 * cheaper than picking N first and backtracking.
 *
 * Fresh (never-used) candidates are always preferred. `recentlyUsedTrackIds`
 * (within the cooldown window) are hard-excluded — never reused. Candidates
 * used before the cooldown are only drawn on if fresh candidates run out,
 * capped at MAX_REPEATED_TRACKS_PER_EPISODE, so a thin seed-artist pool
 * degrades gracefully instead of hard-failing every week once exhausted.
 *
 * The result is then reordered so the strongest tracks open the episode
 * (see buildOpeningHook) and same-artist picks never end up back-to-back.
 */
export async function buildEpisodeTracks(
  candidates: readonly Track[],
  recentlyUsedTrackIds: ReadonlySet<string>,
  allTimeUsedTrackIds: ReadonlySet<string>,
  itunes: ItunesClient,
  count: number,
  lookupDelayMs: number = ITUNES_LOOKUP_DELAY_MS,
): Promise<EpisodeTrack[]> {
  const seenIds = new Set<string>();
  const artistCounts = new Map<string, number>();
  const result: EpisodeTrack[] = [];
  let reusedCount = 0;

  async function tryAdd(track: Track, allowReuse: boolean): Promise<void> {
    if (recentlyUsedTrackIds.has(track.id) || seenIds.has(track.id)) {
      return;
    }
    const isReuse = allTimeUsedTrackIds.has(track.id);
    if (isReuse && !allowReuse) {
      return;
    }
    if ((artistCounts.get(track.artist) ?? 0) >= MAX_TRACKS_PER_ARTIST) {
      return;
    }
    seenIds.add(track.id);

    const preview = await itunes.findPreviewByTitleAndArtist(track.title, track.artist);
    await sleep(lookupDelayMs);
    if (!preview) {
      return;
    }

    artistCounts.set(track.artist, (artistCounts.get(track.artist) ?? 0) + 1);
    result.push({ ...track, audioUrl: preview.previewUrl });
    if (isReuse) {
      reusedCount++;
    }
  }

  for (const track of candidates) {
    if (result.length === count) {
      break;
    }
    await tryAdd(track, false);
  }

  if (result.length < count) {
    for (const track of candidates) {
      if (result.length === count || reusedCount >= MAX_REPEATED_TRACKS_PER_EPISODE) {
        break;
      }
      await tryAdd(track, true);
    }
  }

  if (result.length < count) {
    throw new InsufficientTracksError(count, result.length);
  }

  return buildOpeningHook(result, OPENING_HOOK_SIZE);
}
