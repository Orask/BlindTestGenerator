import { InsufficientTracksError, type Track } from "@blindtest/core";
import type { ItunesClient } from "@blindtest/itunes";

export interface EpisodeTrack extends Track {
  readonly audioUrl: string;
}

/**
 * Applies anti-repeat + de-duplication (like core's selectEpisodeTracks) and
 * audio resolution in a single pass, since a track only "counts" once we
 * know a preview is actually available for it — skipping straight to the
 * next candidate is cheaper than picking N first and backtracking.
 */
export async function buildEpisodeTracks(
  candidates: readonly Track[],
  alreadyUsedTrackIds: ReadonlySet<string>,
  itunes: ItunesClient,
  count: number,
): Promise<EpisodeTrack[]> {
  const seenIds = new Set<string>();
  const result: EpisodeTrack[] = [];

  for (const track of candidates) {
    if (result.length === count) {
      break;
    }
    if (alreadyUsedTrackIds.has(track.id) || seenIds.has(track.id)) {
      continue;
    }
    seenIds.add(track.id);

    const preview = await itunes.findPreviewByTitleAndArtist(track.title, track.artist);
    if (!preview) {
      continue;
    }

    result.push({ ...track, audioUrl: preview.previewUrl });
  }

  if (result.length < count) {
    throw new InsufficientTracksError(count, result.length);
  }

  return result;
}
