import { getUsedTracksForChannel, type UsedTrack } from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { hydrateShortTrack } from "./hydrate-track.js";
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
 * highest real Spotify popularity among tracks_used rows credited to this
 * artist, not necessarily the artist's biggest hits overall — an honest
 * framing given the data actually available, see buildTopArtisteMetadata's
 * title wording in youtube-metadata.ts.
 */
export async function selectTopArtisteTracks(
  db: Database.Database,
  spotify: SpotifyClient,
  itunes: ItunesClient,
  channelId: string,
  artistName: string,
  count: number,
  lookupDelayMs?: number,
): Promise<ShortCandidateTrack[]> {
  const normalizedArtist = normalize(artistName);
  const allTracks = getUsedTracksForChannel(db, channelId);
  const matching = allTracks.filter((track) => normalize(track.artist).includes(normalizedArtist));

  const withPopularity: { track: UsedTrack; popularity: number; cover: string }[] = [];
  for (const track of matching) {
    const metadata = await spotify.getTrackById(track.spotifyTrackId);
    withPopularity.push({ track, popularity: metadata.popularity, cover: metadata.albumCoverUrl });
  }
  withPopularity.sort((a, b) => b.popularity - a.popularity);

  const tracks: ShortCandidateTrack[] = [];
  for (const { track, cover } of withPopularity) {
    if (tracks.length === count) {
      break;
    }
    const hydrated = await hydrateShortTrack(
      itunes,
      track.title,
      track.artist,
      cover,
      lookupDelayMs,
    );
    if (hydrated) {
      tracks.push(hydrated);
    }
  }
  return tracks;
}
