import { getUsedTracksForChannel, type UsedTrack } from "@blindtest/db";
import type { DeezerClient } from "@blindtest/deezer";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { hydrateShortTrack } from "./hydrate-track.js";
import { popularitySignal } from "./popularity-signal.js";
import type { ShortCandidateTrack } from "./types.js";

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

// Same normalize-and-substring-match approach as
// match-blocked-track-rows.ts — tracks_used.artist is the joined display
// string ("Vitaa, Slimane"), so an exact match on a single artist name
// would miss every collab credit.
function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

/**
 * Family A, type 3: the channel's best tracks *of one specific artist*,
 * built entirely from what this channel has already featured
 * (getUsedTracksForChannel, across every theme/episode) — deliberately
 * never an artist-top-tracks API call, which this Spotify app tier doesn't
 * have access to (see docs/CAHIER_DES_CHARGES.md 3bis). "Best" means
 * highest notoriety (Deezer's `rank`, see popularity-signal.ts — Spotify's
 * own `popularity` field this used originally was removed by Spotify's
 * February 2026 changelog, see docs/CLOUD_SESSION_LOG.md) among tracks_used
 * rows credited to this artist, not necessarily the artist's biggest hits
 * overall — an honest framing given the data actually available, see
 * buildTopArtisteMetadata's title wording in youtube-metadata.ts.
 */
export async function selectTopArtisteTracks(
  db: Database.Database,
  spotify: SpotifyClient,
  deezer: DeezerClient,
  itunes: ItunesClient,
  channelId: string,
  artistName: string,
  count: number,
  lookupDelayMs?: number,
): Promise<ShortCandidateTrack[]> {
  const normalizedArtist = normalize(artistName);
  const allTracks = getUsedTracksForChannel(db, channelId);
  const matching = allTracks.filter((track) => normalize(track.artist).includes(normalizedArtist));

  const scored: { track: UsedTrack; score: number }[] = [];
  for (const track of matching) {
    const score = await popularitySignal(deezer, track.title, track.artist, lookupDelayMs);
    scored.push({ track, score });
  }
  scored.sort((a, b) => b.score - a.score);

  const tracks: ShortCandidateTrack[] = [];
  for (const { track } of scored) {
    if (tracks.length === count) {
      break;
    }
    const metadata = await spotify.getTrackById(track.spotifyTrackId);
    const hydrated = await hydrateShortTrack(
      itunes,
      track.title,
      track.artist,
      metadata.albumCoverUrl,
      lookupDelayMs,
    );
    if (hydrated) {
      tracks.push(hydrated);
    }
  }
  return tracks;
}
