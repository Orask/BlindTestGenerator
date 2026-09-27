import { getUsedTrackIds } from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { parseReleaseDate } from "./anniversaire-sortie.js";
import { hydrateShortTrack } from "./hydrate-track.js";
import type { ShortCandidateTrack } from "./types.js";

// How many artists a genre search returns to scan for recent releases —
// small on purpose: searchArtists's relevance ordering means later results
// drift off-topic fast (see its own doc comment in
// packages/integrations/spotify/src/types.ts), and each artist costs one
// more searchTracksByArtist call.
const ARTIST_SEARCH_LIMIT = 10;
// How many of an artist's own top search results to scan for their most
// recent release — this app tier has no "artist's newest track" endpoint
// (see docs/CLOUD_SESSION_LOG.md, famille B), so this is a best-effort scan
// of whatever searchTracksByArtist already surfaces for other pipeline uses.
const TRACKS_PER_ARTIST_LIMIT = 5;
// A track older than this is not a "new release" by any reasonable
// definition of the word, however it ranked in the search — without this
// cutoff, a quiet week (no genuinely new releases from any scanned artist)
// would silently fall back to old catalog tracks instead of finding nothing.
const MAX_RELEASE_AGE_DAYS = 60;

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

/** Builds the normalized "title|artist" keys a caller can pass as `excludeKeys` — e.g. from a channel's configured curatedTracks, see generate-short-nouveaute.ts. */
export function titleArtistKey(title: string, artist: string): string {
  return `${normalize(title)}|${normalize(artist)}`;
}

/**
 * Family B, types 5/6: a handful of genuinely NEW releases for a given
 * genre/style search query (e.g. "rap francais", "house", "variete") —
 * deliberately generic over the genre string rather than one file per
 * genre, since the selection logic is identical and only the query/label
 * changes (see generate-short-nouveaute.ts, invoked once per genre).
 *
 * Pure traffic generation (see docs/CLOUD_SESSION_LOG.md, famille B): never
 * touches tracks_used (excludes anything already there via getUsedTrackIds)
 * and never reuses a channel's curatedTracks (via the caller-supplied
 * `excludeKeys`) — these Shorts are about real current music, not a teaser
 * for an episode.
 *
 * Data source: no new endpoint (browse/new-releases is confirmed removed,
 * tag:new is album-only and reported unstable — see docs/CLOUD_SESSION_LOG.md).
 * Composes two endpoints already in production use elsewhere in this
 * pipeline — searchArtists (discover-artists.ts) and searchTracksByArtist
 * (the main episode pipeline) — and filters/sorts client-side by
 * album.release_date.
 */
export async function selectNewReleaseTracks(
  db: Database.Database,
  spotify: SpotifyClient,
  itunes: ItunesClient,
  channelId: string,
  genreQuery: string,
  count: number,
  referenceDate: Date = new Date(),
  excludeKeys: ReadonlySet<string> = new Set(),
  lookupDelayMs?: number,
): Promise<ShortCandidateTrack[]> {
  const alreadyUsed = getUsedTrackIds(db, channelId);
  const artistNames = await spotify.searchArtists(genreQuery, ARTIST_SEARCH_LIMIT);

  const candidates: {
    title: string;
    artist: string;
    albumCoverUrl: string;
    releaseDate: Date;
  }[] = [];

  for (const artistName of artistNames) {
    const tracks = await spotify.searchTracksByArtist(artistName, TRACKS_PER_ARTIST_LIMIT);
    for (const track of tracks) {
      if (alreadyUsed.has(track.id) || excludeKeys.has(titleArtistKey(track.title, track.artist))) {
        continue;
      }
      const release = parseReleaseDate(track.releaseDate);
      if (!release) {
        continue;
      }
      const ageDays = (referenceDate.getTime() - release.getTime()) / (24 * 60 * 60 * 1000);
      if (ageDays < 0 || ageDays > MAX_RELEASE_AGE_DAYS) {
        continue;
      }
      candidates.push({
        title: track.title,
        artist: track.artist,
        albumCoverUrl: track.albumCoverUrl,
        releaseDate: release,
      });
    }
  }

  candidates.sort((a, b) => b.releaseDate.getTime() - a.releaseDate.getTime());

  const result: ShortCandidateTrack[] = [];
  for (const candidate of candidates) {
    if (result.length === count) {
      break;
    }
    const hydrated = await hydrateShortTrack(
      itunes,
      candidate.title,
      candidate.artist,
      candidate.albumCoverUrl,
      lookupDelayMs,
    );
    if (hydrated) {
      result.push(hydrated);
    }
  }
  return result;
}
