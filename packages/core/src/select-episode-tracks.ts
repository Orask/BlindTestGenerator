import type { Track } from "./types.js";

export class InsufficientTracksError extends Error {
  constructor(needed: number, found: number) {
    super(`Not enough fresh candidates: needed ${needed}, found ${found}.`);
    this.name = "InsufficientTracksError";
  }
}

/**
 * Picks `count` tracks for an episode from `candidates`, skipping any track
 * already present in `alreadyUsedTrackIds` (the channel's full history) and
 * de-duplicating the candidate list itself.
 */
export function selectEpisodeTracks(
  candidates: readonly Track[],
  alreadyUsedTrackIds: ReadonlySet<string>,
  count: number,
): Track[] {
  const seen = new Set<string>();
  const fresh: Track[] = [];

  for (const track of candidates) {
    if (alreadyUsedTrackIds.has(track.id) || seen.has(track.id)) {
      continue;
    }
    seen.add(track.id);
    fresh.push(track);
    if (fresh.length === count) {
      break;
    }
  }

  if (fresh.length < count) {
    throw new InsufficientTracksError(count, fresh.length);
  }

  return fresh;
}
