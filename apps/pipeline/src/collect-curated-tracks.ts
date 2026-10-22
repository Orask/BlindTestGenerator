import type { Track } from "@blindtest/core";
import type { SpotifyClient } from "@blindtest/spotify";

export interface CuratedTrackSpec {
  readonly title: string;
  readonly artist: string;
}

/**
 * Resolves a theme's curatedTracks (specific title/artist pairs, see
 * channel-config.ts) via exact-match search instead of the looser
 * artist-name search collect-candidates.ts uses — the point of curating a
 * pair explicitly is to only ever get that one recognizable track, never a
 * plausible-looking but wrong or obscure result. A pair that doesn't match
 * anything on Spotify is skipped (logged), not fatal — a typo or a
 * catalog gap in one entry shouldn't block the other ~59 tracks.
 */
/**
 * Called once per pair with the outcome — `match` is null on a failure.
 * Lets a caller remember an "introuvable" result (see pipeline.ts's
 * catalog shadow-write) instead of it silently repeating identically on
 * every future run, without this collector itself taking on a DB
 * dependency.
 */
export type CuratedTrackResolutionListener = (pair: CuratedTrackSpec, match: Track | null) => void;

export async function collectCuratedTracks(
  spotify: SpotifyClient,
  pairs: readonly CuratedTrackSpec[],
  onResolution?: CuratedTrackResolutionListener,
): Promise<Track[]> {
  const tracks: Track[] = [];
  for (const pair of pairs) {
    const match = await spotify.searchTrackByTitleAndArtist(pair.title, pair.artist);
    onResolution?.(pair, match);
    if (!match) {
      console.warn(
        `Morceau curaté introuvable sur Spotify, ignoré : "${pair.title}" — ${pair.artist}`,
      );
      continue;
    }
    tracks.push(match);
  }
  return tracks;
}
