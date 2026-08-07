import { InsufficientTracksError, type Track } from "@blindtest/core";
import type { ItunesClient } from "@blindtest/itunes";
import { spreadOutArtists } from "./diversify-artists.js";

export interface EpisodeTrack extends Track {
  readonly audioUrl: string;
}

const MAX_TRACKS_PER_ARTIST = 2;

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
