import type { ItunesClient } from "@blindtest/itunes";
import type { ShortCandidateTrack } from "./types.js";

// Same pacing as build-episode-tracks.ts's own iTunes lookups — see that
// file's ITUNES_LOOKUP_DELAY_MS doc comment for why (iTunes Search's
// unofficial ~20 req/min limit).
const ITUNES_LOOKUP_DELAY_MS = 3500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The one step every Short type selector needs after it has picked a
 * (title, artist, cover) candidate from Spotify: resolve a playable audio
 * preview via iTunes. Returns null (never throws) when no preview is
 * found — same "skip, don't crash" policy as collectCuratedTracks/
 * buildEpisodeTracks, so one bad lookup can't take down an otherwise-good
 * candidate list.
 */
export async function hydrateShortTrack(
  itunes: ItunesClient,
  title: string,
  artist: string,
  albumCoverUrl: string,
  lookupDelayMs: number = ITUNES_LOOKUP_DELAY_MS,
): Promise<ShortCandidateTrack | null> {
  const preview = await itunes.findPreviewByTitleAndArtist(title, artist);
  await sleep(lookupDelayMs);
  if (!preview) {
    return null;
  }
  return { title, artist, albumCoverUrl, audioUrl: preview.previewUrl };
}
