import { InsufficientTracksError, type Track } from "@blindtest/core";
import type { ItunesClient } from "@blindtest/itunes";
import { buildOpeningHook } from "./opening-hook.js";

export interface EpisodeTrack extends Track {
  readonly audioUrl: string;
}

const MAX_TRACKS_PER_ARTIST = 2;
const OPENING_HOOK_SIZE = 5;

// Last-resort valve for when fresh + cooldown-reuse still aren't enough: a
// small share of the episode's most mainstream artists (by how deep their
// catalog ran in this theme's raw candidate pool — the closest proxy
// available, since Spotify strips real popularity for new apps) may
// contribute a 3rd track instead of the usual 2. Solo-credit tracks only,
// and never a reused/cooldown track — this only spends otherwise-unused
// fresh candidates that the normal cap was blocking.
const BONUS_ARTIST_SHARE = 0.1;

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
    // Checked against every individual credited artist, not the joined
    // display string — otherwise a featured artist credited under different
    // collaboration strings (e.g. "X, Nicoletta" vs "Y, Nicoletta") slips
    // past the cap entirely, since neither string ever repeats on its own.
    const wouldExceedCap = track.artistNames.some(
      (name) => (artistCounts.get(name) ?? 0) >= MAX_TRACKS_PER_ARTIST,
    );
    if (wouldExceedCap) {
      return;
    }
    seenIds.add(track.id);

    const preview = await itunes.findPreviewByTitleAndArtist(track.title, track.artist);
    await sleep(lookupDelayMs);
    if (!preview) {
      return;
    }

    for (const name of track.artistNames) {
      artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1);
    }
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
    const catalogDepth = new Map<string, number>();
    for (const track of candidates) {
      for (const name of track.artistNames) {
        catalogDepth.set(name, (catalogDepth.get(name) ?? 0) + 1);
      }
    }
    const maxBonusArtists = Math.max(1, Math.ceil(artistCounts.size * BONUS_ARTIST_SHARE));
    const bonusEligible = new Set(
      [...artistCounts.keys()]
        .sort((a, b) => (catalogDepth.get(b) ?? 0) - (catalogDepth.get(a) ?? 0))
        .slice(0, maxBonusArtists),
    );
    const bonusGranted = new Set<string>();

    for (const track of candidates) {
      if (result.length === count) {
        break;
      }
      if (track.artistNames.length !== 1) {
        continue; // solo tracks only — keeps the per-artist bonus bookkeeping unambiguous for collabs
      }
      const [name] = track.artistNames as [string];
      if (!bonusEligible.has(name) || (artistCounts.get(name) ?? 0) !== MAX_TRACKS_PER_ARTIST) {
        continue;
      }
      if (bonusGranted.size >= maxBonusArtists && !bonusGranted.has(name)) {
        continue;
      }
      if (
        recentlyUsedTrackIds.has(track.id) ||
        seenIds.has(track.id) ||
        allTimeUsedTrackIds.has(track.id)
      ) {
        continue;
      }

      seenIds.add(track.id);
      const preview = await itunes.findPreviewByTitleAndArtist(track.title, track.artist);
      await sleep(lookupDelayMs);
      if (!preview) {
        continue;
      }

      artistCounts.set(name, MAX_TRACKS_PER_ARTIST + 1);
      bonusGranted.add(name);
      result.push({ ...track, audioUrl: preview.previewUrl });
    }
  }

  if (result.length < count) {
    throw new InsufficientTracksError(count, result.length);
  }

  return buildOpeningHook(result, OPENING_HOOK_SIZE);
}
