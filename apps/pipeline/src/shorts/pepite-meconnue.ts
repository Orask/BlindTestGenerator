import type { DeezerClient } from "@blindtest/deezer";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { hydrateShortTrack } from "./hydrate-track.js";
import { popularitySignal } from "./popularity-signal.js";
import type { ShortCandidateTrack } from "./types.js";

/**
 * Family A, type 2: same episode as "devine la chanson", but the *least*
 * well-known tracks instead of the opening hook — a "hidden gem you
 * probably missed" angle instead of "guess the obvious ones". Scored via
 * Deezer's `rank` (see popularity-signal.ts) — Spotify's own `popularity`
 * field, used here originally, was removed by Spotify's February 2026
 * changelog (see docs/CLOUD_SESSION_LOG.md); Deezer never required
 * authentication for this kind of lookup, so it isn't affected.
 *
 * Cost note: unlike selectDevineLaChansonTracks pre-Deezer (which only
 * re-fetched the `count` tracks it actually used), this has to score
 * *every* track_used row of the episode to know which ones are least
 * known — one Deezer + one Spotify call per track in the episode (~40-60),
 * not just the ones that end up in the Short. Acceptable for a
 * once-in-a-while Short, but not free.
 */
export async function selectPepiteMeconnueTracks(
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
  scored.sort((a, b) => a.score - b.score);

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
