import { InsufficientTracksError, type Track } from "@blindtest/core";
import type { ItunesClient } from "@blindtest/itunes";
import { spreadOutArtists } from "./diversify-artists.js";

export interface EpisodeTrack extends Track {
  readonly audioUrl: string;
}

const MAX_TRACKS_PER_ARTIST = 2;

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
 * Applies anti-repeat + de-duplication (like core's selectEpisodeTracks),
 * audio resolution, and a per-artist cap in a single pass, since a track
 * only "counts" once we know a preview is actually available for it —
 * skipping straight to the next candidate is cheaper than picking N first
 * and backtracking. Tracks are then reordered so same-artist picks never
 * end up back-to-back.
 */
export async function buildEpisodeTracks(
  candidates: readonly Track[],
  alreadyUsedTrackIds: ReadonlySet<string>,
  itunes: ItunesClient,
  count: number,
  lookupDelayMs: number = ITUNES_LOOKUP_DELAY_MS,
): Promise<EpisodeTrack[]> {
  const seenIds = new Set<string>();
  const artistCounts = new Map<string, number>();
  const result: EpisodeTrack[] = [];

  for (const track of candidates) {
    if (result.length === count) {
      break;
    }
    if (alreadyUsedTrackIds.has(track.id) || seenIds.has(track.id)) {
      continue;
    }
    if ((artistCounts.get(track.artist) ?? 0) >= MAX_TRACKS_PER_ARTIST) {
      continue;
    }
    seenIds.add(track.id);

    const preview = await itunes.findPreviewByTitleAndArtist(track.title, track.artist);
    await sleep(lookupDelayMs);
    if (!preview) {
      continue;
    }

    artistCounts.set(track.artist, (artistCounts.get(track.artist) ?? 0) + 1);
    result.push({ ...track, audioUrl: preview.previewUrl });
  }

  if (result.length < count) {
    throw new InsufficientTracksError(count, result.length);
  }

  return spreadOutArtists(result);
}
