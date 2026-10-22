import type { AnthropicClient } from "@blindtest/anthropic";
import type { ChannelTheme, Track } from "@blindtest/core";
import {
  countAudioReadyCatalogTracks,
  getCatalogTracksNeedingAudioCheck,
  markCatalogTrackAudioChecked,
  recordSpotifyResolution,
  upsertCatalogTrack,
  type CatalogTrackSource,
} from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type Database from "better-sqlite3";
import { collectCandidateTracks } from "./collect-candidates.js";
import { collectCuratedTracks } from "./collect-curated-tracks.js";
import { discoverNewArtists } from "./discover-artists.js";
import { appendDiscoveredArtists } from "./persist-discovered-artists.js";

// Mirrors pipeline.ts's own constants of the same name — kept as a
// separate local copy rather than a shared import, matching how small
// per-file constants are already duplicated elsewhere in this codebase
// (e.g. the normalize/cacheKey helper in caching-itunes-client.ts,
// match-blocked-track-rows.ts and build-episode-tracks.ts).
const CANDIDATES_PER_ARTIST = 20;
const DISCOVERY_MAX_NEW_ARTISTS = 12;
const ITUNES_LOOKUP_DELAY_MS = 3500;
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function catalogCacheKey(title: string, artist: string): string {
  const normalize = (value: string): string =>
    value.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
  return `${normalize(title)}|${normalize(artist)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface PopulateCatalogResult {
  /** Candidates upserted into catalog_tracks this run (curated + seedArtists + any discovery pass). */
  readonly discovered: number;
  /** Rows that got a fresh iTunes preview check this run. */
  readonly audioChecked: number;
  /** Of those, how many became selectable (audio_ready). */
  readonly promoted: number;
  /** Of those, how many were rejected (no preview found). */
  readonly ineligible: number;
  /** audio_ready rows for this theme once this run finished. */
  readonly audioReadyDepth: number;
  /** Whether a discovery pass ran because the depth was still short of targetDepth. */
  readonly discoveryRan: boolean;
}

/**
 * Populates apps/pipeline/src's shared catalog_tracks table for one theme,
 * independent of any one day's publish run (see schema.ts's comment on
 * catalog_tracks, and /Users/lucaslordon/.claude/plans/hazy-stargazing-peach.md
 * for the full migration plan this is step 2 of). Reuses today's live
 * collection logic unchanged — the only new behavior here is writing the
 * outcome (success, resolution failure, or iTunes-preview availability)
 * somewhere persistent instead of letting it vanish at the end of the run.
 *
 * `targetDepth` is this theme's desired audio_ready buffer (comfortably
 * above tracksPerEpisode plus cooldown headroom — the exact number is a
 * populate-cadence decision for whoever schedules this, not baked in
 * here). Discovery only runs when the theme still falls short of it after
 * the curated/seedArtists pass, mirroring the existing reactive fallback
 * in pipeline.ts's buildTracksWithDiscoveryFallback but checked proactively
 * instead of waiting for a live run to throw InsufficientTracksError.
 */
export async function populateCatalogForTheme(
  db: Database.Database,
  spotify: SpotifyClient,
  itunes: ItunesClient,
  channelConfigPath: string,
  theme: ChannelTheme,
  targetDepth: number,
  lookupDelayMs: number = ITUNES_LOOKUP_DELAY_MS,
  anthropic?: AnthropicClient,
): Promise<PopulateCatalogResult> {
  let discovered = 0;

  function shadowWriteCatalog(tracks: readonly Track[], source: CatalogTrackSource): void {
    const now = new Date();
    for (const track of tracks) {
      upsertCatalogTrack(db, {
        themeId: theme.id,
        spotifyTrackId: track.id,
        title: track.title,
        artist: track.artist,
        artistNames: track.artistNames,
        source,
        cacheKey: catalogCacheKey(track.title, track.artist),
        discoveredAt: now,
      });
      discovered++;
    }
  }

  let audioChecked = 0;
  let promoted = 0;
  let ineligible = 0;

  // Bounded per run, not "until the theme is fully checked" — iTunes's
  // informal rate limit means a thin theme's backlog is worked down over
  // several scheduled invocations rather than one long-running call.
  async function runAudioCheckPass(): Promise<void> {
    const pending = getCatalogTracksNeedingAudioCheck(db, theme.id, targetDepth * 2);
    for (const candidate of pending) {
      let preview;
      try {
        preview = await itunes.findPreviewByTitleAndArtist(candidate.title, candidate.artist);
      } catch {
        preview = null;
      }
      await sleep(lookupDelayMs);
      audioChecked++;
      if (preview) {
        markCatalogTrackAudioChecked(db, theme.id, candidate.spotifyTrackId, {
          status: "audio_ready",
        });
        promoted++;
      } else {
        markCatalogTrackAudioChecked(db, theme.id, candidate.spotifyTrackId, {
          status: "ineligible",
          ineligibleReason: "no_itunes_preview",
        });
        ineligible++;
      }
    }
  }

  const curatedTracks = theme.curatedTracks
    ? await collectCuratedTracks(spotify, theme.curatedTracks, (pair, match) => {
        const key = catalogCacheKey(pair.title, pair.artist);
        recordSpotifyResolution(db, key, match ? "resolved" : "not_found", match?.id ?? null);
      })
    : [];
  shadowWriteCatalog(curatedTracks, "curated");

  const seedArtistCandidates = await collectCandidateTracks(
    spotify,
    theme.seedArtists,
    CANDIDATES_PER_ARTIST,
  );
  shadowWriteCatalog(seedArtistCandidates, "seed_artist");

  // Audio-checked BEFORE the discovery decision below — depth has to
  // reflect how many of today's own candidates actually turned out
  // audio_ready, not just how many were discovered (a 'discovered' row
  // doesn't count toward the buffer discovery exists to top up).
  await runAudioCheckPass();

  let discoveryRan = false;
  if (countAudioReadyCatalogTracks(db, theme.id) < targetDepth && theme.discoveryQuery) {
    const newArtists = await discoverNewArtists(
      spotify,
      theme.discoveryQuery,
      theme.seedArtists,
      DISCOVERY_MAX_NEW_ARTISTS,
      anthropic,
    );
    if (newArtists.length > 0) {
      discoveryRan = true;
      await appendDiscoveredArtists(channelConfigPath, theme.id, newArtists);
      const discoveredCandidates = await collectCandidateTracks(
        spotify,
        newArtists,
        CANDIDATES_PER_ARTIST,
      );
      shadowWriteCatalog(discoveredCandidates, "discovered");
      await runAudioCheckPass();
    }
  }

  return {
    discovered,
    audioChecked,
    promoted,
    ineligible,
    audioReadyDepth: countAudioReadyCatalogTracks(db, theme.id),
    discoveryRan,
  };
}
