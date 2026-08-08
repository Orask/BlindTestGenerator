import { spreadOutArtists } from "./diversify-artists.js";

/**
 * Puts the episode's strongest tracks first — the opening minutes are what
 * decides whether a viewer stays, so each artist's `popularityRank === 0`
 * pick (their best-known song, per Spotify's own search relevance order —
 * see the Track.popularityRank doc comment) is pulled to the front, then
 * the rest of the episode follows in its usual artist-diversified order.
 */
export function buildOpeningHook<
  T extends { readonly artist: string; readonly popularityRank?: number | undefined },
>(tracks: readonly T[], hookSize: number): T[] {
  const signature = tracks.filter((track) => track.popularityRank === 0);

  const opening = spreadOutArtists(signature).slice(0, hookSize);
  const openingSet = new Set(opening);
  const remainder = tracks.filter((track) => !openingSet.has(track));

  const spreadRemainder = spreadOutArtists(remainder);

  // Avoid a same-artist seam right where the hook hands off to the rest.
  const lastHookTrack = opening[opening.length - 1];
  if (lastHookTrack && spreadRemainder[0]?.artist === lastHookTrack.artist) {
    const swapIndex = spreadRemainder.findIndex((track) => track.artist !== lastHookTrack.artist);
    if (swapIndex > 0) {
      const [first] = spreadRemainder;
      spreadRemainder[0] = spreadRemainder[swapIndex]!;
      spreadRemainder[swapIndex] = first!;
    }
  }

  return [...opening, ...spreadRemainder];
}
