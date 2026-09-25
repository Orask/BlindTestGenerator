import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import {
  InsufficientTracksError,
  nextPublishDateTime,
  resolveThemeForDay,
  weekdayFromDate,
  type ChannelConfig,
  type ChannelTheme,
} from "@blindtest/core";
import type { AnthropicClient } from "@blindtest/anthropic";
import {
  countVideosForTheme,
  createVideo,
  getBlockedTrackIds,
  getRecentTracksForTheme,
  getUsedTrackIds,
  getUsedTrackIdsSince,
  getPlaylistId,
  markVideoFailed,
  markVideoUploaded,
  openDatabase,
  recordTrackUsage,
  setPlaylistId,
} from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type Database from "better-sqlite3";
import type { SpotifyClient } from "@blindtest/spotify";
import type { YoutubeClient } from "@blindtest/youtube";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import {
  buildEpisodeTracks,
  REUSE_COOLDOWN_DAYS,
  type EpisodeTrack,
} from "./build-episode-tracks.js";
import { collectCandidateTracks } from "./collect-candidates.js";
import { discoverNewArtists } from "./discover-artists.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { appendDiscoveredArtists } from "./persist-discovered-artists.js";
import { renderEpisode } from "./render-episode.js";
import { renderThumbnail } from "./render-thumbnail.js";
import { reviewEpisode } from "./review-episode.js";
import { syncChannelToDb } from "./sync-channel-to-db.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";
import { buildYoutubeMetadata } from "./youtube-metadata.js";

const DEFAULT_TRACKS_PER_EPISODE = 60;
// Above Spotify's 10-per-call cap, searchTracksByArtist pages internally to
// reach it (see MAX_ARTIST_SEARCH_PAGES in the spotify client) — worth
// paying for since a weekly-recurring theme's top-10-per-artist candidates
// are exactly what the reuse cooldown depletes fastest week over week
// (confirmed live: Rap FR's 74-artist pool still fell short, 37/60, even
// after auto-discovery, because most artists' top 10 was mostly
// cooldown-locked from the previous week's episode).
const CANDIDATES_PER_ARTIST = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Generous but bounded: covers a shortfall many times over even at a
// modest post-filter yield per artist, without turning a thin theme into a
// runaway number of live Spotify calls.
const DISCOVERY_MAX_NEW_ARTISTS = 12;
// How far back "recent weeks" reaches for the AI review's over-repetition
// check (see review-episode.ts) — 5 weeks of a weekly-recurring theme.
const REVIEW_HISTORY_DAYS = 35;

// Thumbnail/playlist calls happen after the video is already live — a
// transient YouTube-side error there (confirmed live: a bare 409 "ABORTED"
// on playlistItems.insert, unrelated to anything we sent) shouldn't be
// allowed to look like the whole publish failed. gaxios's own retry only
// covers 5xx/408/429, not this case, so this covers it directly.
const YOUTUBE_METADATA_RETRIES = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withYoutubeRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= YOUTUBE_METADATA_RETRIES - 1) {
        throw error;
      }
      await sleep(2 ** attempt * 1000);
    }
  }
}

export interface PipelineDeps {
  readonly spotify: SpotifyClient;
  readonly itunes: ItunesClient;
  readonly youtube: YoutubeClient;
  /** Undefined when ANTHROPIC_API_KEY isn't configured — the review step is then skipped entirely (see reviewEpisodeIfConfigured). */
  readonly anthropic: AnthropicClient | undefined;
  readonly dbPath: string;
  readonly outputDir: string;
  /** Channel config JSON path — written back to when discovery finds new artists (see appendDiscoveredArtists). */
  readonly channelConfigPath: string;
  /** Override for quick smoke tests — a full episode is 40 by default. */
  readonly tracksPerEpisode: number | undefined;
}

/**
 * Runs the AI episode review (see review-episode.ts) only when an Anthropic
 * API key is actually configured — this feature is an optional quality
 * upgrade layered on top of an already-working pipeline, so its absence
 * must never block a run that worked fine before it existed.
 */
async function reviewEpisodeIfConfigured(
  db: Database.Database,
  deps: PipelineDeps,
  theme: ChannelTheme,
  tracks: readonly EpisodeTrack[],
): Promise<readonly EpisodeTrack[]> {
  if (!deps.anthropic) {
    return tracks;
  }

  const since = new Date(Date.now() - REVIEW_HISTORY_DAYS * MS_PER_DAY);
  const recentTracks = getRecentTracksForTheme(db, theme.id, since);

  const {
    tracks: reviewed,
    removed,
    notes,
  } = await reviewEpisode(deps.anthropic, {
    themeLabel: theme.label,
    tracks,
    recentTracks,
  });

  if (removed.length > 0) {
    console.log(
      `Revue IA : ${removed.length} morceau(x) retiré(s) — ${removed.map((t) => `"${t.title}" (${t.artist})`).join(", ")}${notes ? ` (${notes})` : ""}`,
    );
  }

  return reviewed;
}

/**
 * Builds the episode's tracks from the theme's configured seedArtists, and
 * if that falls short (InsufficientTracksError), automatically searches for
 * new on-topic artists (see discover-artists.ts) and retries once with the
 * expanded pool — this is what used to require a manual live-verification
 * + config-edit cycle per thin theme (see docs/CAHIER_DES_CHARGES.md
 * section 3octies) each time a theme's pool thinned out again.
 */
async function buildTracksWithDiscoveryFallback(
  theme: ChannelTheme,
  deps: PipelineDeps,
  recentlyUsedTrackIds: ReadonlySet<string>,
  allTimeUsedTrackIds: ReadonlySet<string>,
  tracksPerEpisode: number,
): Promise<EpisodeTrack[]> {
  const candidates = await collectCandidateTracks(
    deps.spotify,
    theme.seedArtists,
    CANDIDATES_PER_ARTIST,
  );

  try {
    return await buildEpisodeTracks(
      candidates,
      recentlyUsedTrackIds,
      allTimeUsedTrackIds,
      deps.itunes,
      tracksPerEpisode,
    );
  } catch (error) {
    if (!(error instanceof InsufficientTracksError) || !theme.discoveryQuery) {
      throw error;
    }

    console.log(`Vivier insuffisant pour "${theme.label}", recherche de nouveaux artistes...`);
    const newArtists = await discoverNewArtists(
      deps.spotify,
      theme.discoveryQuery,
      theme.seedArtists,
      DISCOVERY_MAX_NEW_ARTISTS,
    );
    if (newArtists.length === 0) {
      throw error;
    }
    console.log(`${newArtists.length} nouvel(aux) artiste(s) trouvé(s) : ${newArtists.join(", ")}`);

    // Persist immediately, before attempting the retry build below: these
    // artists are already live-verified, so even if this run's episode
    // still falls short (the cooldown squeeze can be deeper than one
    // discovery batch can fill), the pool permanently grows for next time
    // instead of being rediscovered — or silently lost — on every thin run.
    await appendDiscoveredArtists(deps.channelConfigPath, theme.id, newArtists);

    const extraCandidates = await collectCandidateTracks(
      deps.spotify,
      newArtists,
      CANDIDATES_PER_ARTIST,
    );
    return await buildEpisodeTracks(
      [...candidates, ...extraCandidates],
      recentlyUsedTrackIds,
      allTimeUsedTrackIds,
      deps.itunes,
      tracksPerEpisode,
    );
  }
}

async function generateAndPublishEpisode(
  db: Database.Database,
  channel: ChannelConfig,
  theme: ChannelTheme,
  deps: PipelineDeps,
  publishAt: Date | undefined,
): Promise<void> {
  console.log(
    `[${channel.name}] Thème : ${theme.label}` +
      (publishAt ? ` (publication prévue ${publishAt.toISOString()})` : ""),
  );

  const tracksPerEpisode = deps.tracksPerEpisode ?? DEFAULT_TRACKS_PER_EPISODE;
  const cooldownCutoff = new Date(Date.now() - REUSE_COOLDOWN_DAYS * MS_PER_DAY);
  // Permanently-blocked tracks (YouTube Content ID took a published episode
  // down worldwide — see blocked-tracks-repository.ts) must never be picked
  // again, under any circumstance, so they're folded into the same
  // hard-exclude set as the reuse cooldown rather than the softer
  // all-time-used one, which the reuse/bonus fallback passes are still
  // allowed to draw from.
  const recentlyUsedTrackIds = new Set([
    ...getUsedTrackIdsSince(db, channel.id, cooldownCutoff),
    ...getBlockedTrackIds(db),
  ]);
  const allTimeUsedTrackIds = getUsedTrackIds(db, channel.id);

  const selectedTracks = await buildTracksWithDiscoveryFallback(
    theme,
    deps,
    recentlyUsedTrackIds,
    allTimeUsedTrackIds,
    tracksPerEpisode,
  );
  console.log(`${selectedTracks.length} morceaux sélectionnés avec extrait audio résolu.`);

  // A track the AI review removes isn't backfilled — see review-episode.ts's
  // MAX_REMOVE_RATIO cap — so an episode can occasionally come out a couple
  // tracks short of tracksPerEpisode. Accepted tradeoff for v1: catching a
  // genuine anachronism (see the ROSÉ/"APT." incident this was built for)
  // matters more than an exact, unreviewed track count.
  const tracks = await reviewEpisodeIfConfigured(db, deps, theme, selectedTracks);

  // Covers must land on disk BEFORE bundling: Remotion's bundler snapshots
  // public/ at bundle time, so anything downloaded afterward 404s from the
  // bundled server (confirmed live — this order used to be backwards and
  // broke every fresh cover in a batch run).
  await resolvePublicCoverUrls(
    tracks.map((track) => track.albumCoverUrl),
    PUBLIC_COVERS_DIR,
  );
  const serveUrl = await bundleVideoRenderer();

  const runId = Date.now();
  const outputPath = `${deps.outputDir}/${channel.id}-${theme.id}-${runId}.mp4`;
  const thumbnailPath = `${deps.outputDir}/${channel.id}-${theme.id}-${runId}-thumbnail.jpg`;

  await renderEpisode({ serveUrl, themeLabel: theme.label, tracks, outputPath });
  console.log(`Vidéo rendue : ${outputPath}`);
  await renderThumbnail({ serveUrl, themeLabel: theme.label, tracks, outputPath: thumbnailPath });
  console.log(`Miniature rendue : ${thumbnailPath}`);

  const videoId = randomUUID();
  createVideo(db, {
    id: videoId,
    channelId: channel.id,
    themeId: theme.id,
    createdAt: new Date(),
    filePath: outputPath,
    visibility: channel.visibility,
    format: "long",
  });

  let youtubeVideoId: string;
  try {
    const episodeNumber = countVideosForTheme(db, theme.id);
    const { title, description, tags } = buildYoutubeMetadata(theme, episodeNumber, tracks);

    // Scheduling only makes sense once the channel is actually meant to go
    // public — for a private/unlisted test config, upload immediately as
    // configured instead of parking it behind YouTube's publishAt gate.
    const effectivePublishAt = channel.visibility === "public" ? publishAt : undefined;

    ({ videoId: youtubeVideoId } = await deps.youtube.uploadVideo({
      filePath: outputPath,
      title,
      description,
      tags,
      visibility: channel.visibility,
      ...(effectivePublishAt ? { publishAt: effectivePublishAt } : {}),
    }));

    console.log(
      effectivePublishAt
        ? `Programmée sur YouTube pour ${effectivePublishAt.toISOString()} : https://youtu.be/${youtubeVideoId}`
        : `Publiée sur YouTube : https://youtu.be/${youtubeVideoId}`,
    );
  } catch (error) {
    markVideoFailed(db, videoId);
    throw error;
  }

  // The video is live on YouTube from this point on — record it and its
  // tracks immediately, before the thumbnail/playlist calls below. Those two
  // are cosmetic/discoverability extras, not the publish itself: confirmed
  // live, a transient YouTube-side error on the playlist call (409 ABORTED)
  // used to bubble up to the catch above and mark an already-published video
  // as "failed", which would have made a retry re-render and re-upload a
  // duplicate, and never mark these tracks as used.
  markVideoUploaded(db, videoId, youtubeVideoId);
  for (const track of tracks) {
    recordTrackUsage(db, {
      channelId: channel.id,
      themeId: theme.id,
      spotifyTrackId: track.id,
      title: track.title,
      artist: track.artist,
      videoId,
      usedAt: new Date(),
    });
  }

  try {
    await withYoutubeRetry(() => deps.youtube.setThumbnail(youtubeVideoId, thumbnailPath));
  } catch (error) {
    console.warn(
      `Échec de l'envoi de la miniature (épisode déjà publié, on continue) : ${(error as Error).message}`,
    );
  }

  try {
    let playlistId = getPlaylistId(db, theme.id);
    if (!playlistId) {
      playlistId = (await deps.youtube.ensurePlaylist(theme.label)).playlistId;
      setPlaylistId(db, theme.id, playlistId);
    }
    const resolvedPlaylistId = playlistId;
    await withYoutubeRetry(() =>
      deps.youtube.addVideoToPlaylist(youtubeVideoId, resolvedPlaylistId),
    );
  } catch (error) {
    console.warn(
      `Échec de l'ajout à la playlist (épisode déjà publié, on continue) : ${(error as Error).message}`,
    );
  }
}

export async function runPipeline(channel: ChannelConfig, deps: PipelineDeps): Promise<void> {
  await mkdir(dirname(deps.dbPath), { recursive: true });
  await mkdir(deps.outputDir, { recursive: true });

  const db = openDatabase(deps.dbPath);
  syncChannelToDb(db, channel);

  const theme = resolveThemeForDay(channel.themes, weekdayFromDate(new Date()));
  await generateAndPublishEpisode(db, channel, theme, deps, undefined);
}

/**
 * Generates and uploads all 7 themes' episodes in one run, each scheduled
 * (via YouTube's publishAt) for its next calendar occurrence — so a single
 * weekly run covers the whole week instead of depending on the Mac being
 * awake every single day. One theme failing (e.g. a transient upload error,
 * or hitting the YouTube API's daily upload quota — 1600 units per upload
 * against a default 10,000/day budget, so more than ~6 uploads in a day
 * will start failing) doesn't stop the rest from being attempted.
 */
export async function runWeeklyBatch(
  channel: ChannelConfig,
  deps: PipelineDeps,
  from: Date = new Date(),
): Promise<void> {
  await mkdir(dirname(deps.dbPath), { recursive: true });
  await mkdir(deps.outputDir, { recursive: true });

  const db = openDatabase(deps.dbPath);
  syncChannelToDb(db, channel);

  const schedule = channel.themes
    .map((theme) => ({
      theme,
      publishAt: nextPublishDateTime(theme.day, from, channel.publishHourLocal),
    }))
    .sort((a, b) => a.publishAt.getTime() - b.publishAt.getTime());

  const failures: { theme: string; error: unknown }[] = [];
  for (const { theme, publishAt } of schedule) {
    try {
      await generateAndPublishEpisode(db, channel, theme, deps, publishAt);
    } catch (error) {
      console.error(`Échec pour le thème "${theme.label}" :`, error);
      failures.push({ theme: theme.label, error });
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `${failures.length}/${schedule.length} épisode(s) ont échoué : ${failures.map((f) => f.theme).join(", ")}`,
    );
  }
}
