import { getUsedTracksForChannel } from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { hydrateShortTrack } from "./hydrate-track.js";
import type { ShortCandidateTrack } from "./types.js";

export interface AnniversaryMatch {
  readonly spotifyTrackId: string;
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
  /** Raw Spotify release_date — "YYYY", "YYYY-MM" or "YYYY-MM-DD". */
  readonly releaseDate: string;
  /** The actual calendar date (this year, or within the scanned window) the anniversary falls on. */
  readonly matchDate: Date;
  readonly yearsAgo: number;
}

// Spotify's release_date precision varies by track (release_date_precision:
// "year" | "month" | "day") — a month/day-only date is parsed as if it fell
// on the 1st, which is the best available guess, not a promise of accuracy.
// Exported: shared with shorts/nouveaute-genre.ts (Family B), which needs
// the same parsing to judge how recent a candidate release actually is.
export function parseReleaseDate(raw: string): Date | null {
  const [yearRaw, monthRaw, dayRaw] = raw.split("-");
  const year = Number(yearRaw);
  if (!yearRaw || Number.isNaN(year)) {
    return null;
  }
  const month = monthRaw ? Number(monthRaw) : 1;
  const day = dayRaw ? Number(dayRaw) : 1;
  if (Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Family A, type 4: "this track came out N years ago today" — scans the
 * channel's whole history (getUsedTracksForChannel) for tracks whose
 * release date's month+day falls within
 * [referenceDate, referenceDate + windowDays]. `windowDays: 0` (the
 * default) checks only referenceDate itself; a caller that wants to plan
 * ahead (the whole point of this being schedulable in advance, not just a
 * same-day check — see docs/CLOUD_SESSION_LOG.md) passes a larger window,
 * e.g. 7, to see what's coming up without committing to render anything
 * yet — see find-anniversaries-cli.ts for that reporting-only mode.
 *
 * Cost note: same as selectPepiteMeconnueTracks/selectTopArtisteTracks —
 * one getTrackById call per distinct track the channel has ever used, to
 * read each one's release date. Not cheap over a large history; meant to
 * be run occasionally (e.g. weekly, to plan the next week), not on every
 * single automation run — see the automation script's own scheduling.
 */
export async function findAnniversaryMatches(
  db: Database.Database,
  spotify: SpotifyClient,
  channelId: string,
  referenceDate: Date,
  windowDays = 0,
): Promise<AnniversaryMatch[]> {
  const allTracks = getUsedTracksForChannel(db, channelId);
  const matches: AnniversaryMatch[] = [];

  for (const track of allTracks) {
    const metadata = await spotify.getTrackById(track.spotifyTrackId);
    const release = parseReleaseDate(metadata.releaseDate);
    if (!release) {
      continue;
    }

    for (let offset = 0; offset <= windowDays; offset++) {
      const candidateDate = new Date(referenceDate);
      candidateDate.setUTCDate(candidateDate.getUTCDate() + offset);
      const isSameCalendarDay =
        release.getUTCMonth() === candidateDate.getUTCMonth() &&
        release.getUTCDate() === candidateDate.getUTCDate();
      const isAtLeastOneYearOld = release.getUTCFullYear() < candidateDate.getUTCFullYear();
      if (isSameCalendarDay && isAtLeastOneYearOld) {
        matches.push({
          spotifyTrackId: track.spotifyTrackId,
          title: track.title,
          artist: track.artist,
          albumCoverUrl: metadata.albumCoverUrl,
          releaseDate: metadata.releaseDate,
          matchDate: candidateDate,
          yearsAgo: candidateDate.getUTCFullYear() - release.getUTCFullYear(),
        });
        break;
      }
    }
  }

  return matches;
}

export async function hydrateAnniversaryTrack(
  itunes: ItunesClient,
  match: AnniversaryMatch,
  lookupDelayMs?: number,
): Promise<ShortCandidateTrack | null> {
  return hydrateShortTrack(itunes, match.title, match.artist, match.albumCoverUrl, lookupDelayMs);
}
