import type { DeezerClient } from "@blindtest/deezer";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { hydrateShortTrack } from "./hydrate-track.js";
import { popularitySignal } from "./popularity-signal.js";
import type { ShortCandidateTrack } from "./types.js";

/**
 * Family A, type 1: the original Short type (see docs/CLOUD_SESSION_LOG.md
 * — first prototyped 2026-09-27). Cuts a mini blind-test from an
 * already-published episode's *most recognizable* tracks — scored via
 * Deezer's `rank` (see popularity-signal.ts), not by borrowing
 * buildOpeningHook's ordering as the original version did: that order never
 * compares popularity across different artists (each artist's own tracks
 * are only ranked against each other, see opening-hook.ts), so it's a weak
 * proxy for "everyone will recognize this one" — Deezer's rank is
 * comparable across the whole episode.
 *
 * Cost note: same as selectPepiteMeconnueTracks — scoring is now done
 * across every track_used row of the episode, not just the `count`
 * selected ones, since the whole point is picking the best `count` out of
 * all of them rather than trusting a pre-existing order.
 */
export async function selectDevineLaChansonTracks(
  db: Database.Database,
  spotify: SpotifyClient,
  deezer: DeezerClient,
  itunes: ItunesClient,
  longVideoRowId: string,
  count: number,
  lookupDelayMs?: number,
): Promise<ShortCandidateTrack[]> {
  const trackRows = db
    .prepare(
      "SELECT spotify_track_id, title, artist FROM tracks_used WHERE video_id = ? ORDER BY rowid",
    )
    .all(longVideoRowId) as {
    spotify_track_id: string;
    title: string;
    artist: string;
  }[];

  const scored: { row: (typeof trackRows)[number]; score: number }[] = [];
  for (const row of trackRows) {
    const score = await popularitySignal(deezer, row.title, row.artist, lookupDelayMs);
    scored.push({ row, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const tracks: ShortCandidateTrack[] = [];
  for (const { row } of scored) {
    if (tracks.length === count) {
      break;
    }
    const metadata = await spotify.getTrackById(row.spotify_track_id);
    const hydrated = await hydrateShortTrack(
      itunes,
      row.title,
      row.artist,
      metadata.albumCoverUrl,
      lookupDelayMs,
    );
    if (hydrated) {
      tracks.push(hydrated);
    }
  }
  return tracks;
}
