export interface ArtistBearing {
  readonly artistNames: readonly string[];
}

/**
 * Reorders tracks so that no two adjacent tracks share ANY credited artist —
 * including collaborations/features, where two tracks can list different
 * full artist credits yet still share one performer (a joined "artist"
 * string would hide that overlap entirely). Greedily picks the next track,
 * from those that don't overlap with the one just placed, whose most
 * in-demand artist still has the most tracks waiting — the correct strategy
 * for this rearrangement as long as no artist holds a strict majority of
 * the tracks (guaranteed here since callers cap tracks per artist well
 * below half the episode).
 */
export function spreadOutArtists<T extends ArtistBearing>(tracks: readonly T[]): T[] {
  const remainingCounts = new Map<string, number>();
  for (const track of tracks) {
    for (const name of track.artistNames) {
      remainingCounts.set(name, (remainingCounts.get(name) ?? 0) + 1);
    }
  }

  const remaining = [...tracks];
  const result: T[] = [];
  let lastArtists = new Set<string>();

  const maxRemainingCount = (track: T): number =>
    Math.max(...track.artistNames.map((name) => remainingCounts.get(name) ?? 0));

  while (remaining.length > 0) {
    const nonConflicting = remaining.filter(
      (track) => !track.artistNames.some((name) => lastArtists.has(name)),
    );
    const pool = nonConflicting.length > 0 ? nonConflicting : remaining;
    pool.sort((a, b) => maxRemainingCount(b) - maxRemainingCount(a));

    const picked = pool[0]!;
    result.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
    for (const name of picked.artistNames) {
      remainingCounts.set(name, (remainingCounts.get(name) ?? 0) - 1);
    }
    lastArtists = new Set(picked.artistNames);
  }

  return result;
}
