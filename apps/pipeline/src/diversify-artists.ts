/**
 * Reorders tracks so that no two tracks by the same artist end up adjacent —
 * greedily picks next from whichever remaining artist bucket is largest
 * (other than the one just placed), which is the standard correct strategy
 * for this rearrangement problem as long as no artist holds a strict
 * majority of the tracks (guaranteed here since callers cap tracks per
 * artist well below half the episode).
 */
export function spreadOutArtists<T extends { artist: string }>(tracks: readonly T[]): T[] {
  const buckets = new Map<string, T[]>();
  for (const track of tracks) {
    const bucket = buckets.get(track.artist);
    if (bucket) {
      bucket.push(track);
    } else {
      buckets.set(track.artist, [track]);
    }
  }

  const result: T[] = [];
  let lastArtist: string | null = null;

  while (result.length < tracks.length) {
    const nonEmpty = [...buckets.entries()].filter(([, bucket]) => bucket.length > 0);
    const preferred = nonEmpty.filter(([artist]) => artist !== lastArtist);
    const pool = preferred.length > 0 ? preferred : nonEmpty;
    pool.sort((a, b) => b[1].length - a[1].length);

    const [artist, bucket] = pool[0]!;
    result.push(bucket.shift()!);
    lastArtist = artist;
  }

  return result;
}
