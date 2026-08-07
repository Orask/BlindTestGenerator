import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { resolveThemeForDay, weekdayFromDate, type ChannelConfig } from "@blindtest/core";
import {
  countVideosForTheme,
  createVideo,
  getPlaylistId,
  getUsedTrackIds,
  markVideoFailed,
  markVideoUploaded,
  openDatabase,
  recordTrackUsage,
  setPlaylistId,
} from "@blindtest/db";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type { YoutubeClient } from "@blindtest/youtube";
import { buildEpisodeTracks } from "./build-episode-tracks.js";
import { collectCandidateTracks } from "./collect-candidates.js";
import { renderEpisode } from "./render-episode.js";
import { syncChannelToDb } from "./sync-channel-to-db.js";
import { buildYoutubeMetadata } from "./youtube-metadata.js";

const DEFAULT_TRACKS_PER_EPISODE = 40;
const CANDIDATES_PER_ARTIST = 10;

export interface PipelineDeps {
  readonly spotify: SpotifyClient;
  readonly itunes: ItunesClient;
  readonly youtube: YoutubeClient;
  readonly dbPath: string;
  readonly outputDir: string;
  /** Override for quick smoke tests — a full episode is 40 by default. */
  readonly tracksPerEpisode: number | undefined;
}

export async function runPipeline(channel: ChannelConfig, deps: PipelineDeps): Promise<void> {
  await mkdir(dirname(deps.dbPath), { recursive: true });
  await mkdir(deps.outputDir, { recursive: true });

  const db = openDatabase(deps.dbPath);
  syncChannelToDb(db, channel);

  const theme = resolveThemeForDay(channel.themes, weekdayFromDate(new Date()));
  console.log(`[${channel.name}] Thème du jour : ${theme.label}`);

  const tracksPerEpisode = deps.tracksPerEpisode ?? DEFAULT_TRACKS_PER_EPISODE;
  const alreadyUsedTrackIds = getUsedTrackIds(db, channel.id);
  const candidates = await collectCandidateTracks(
    deps.spotify,
    theme.seedArtists,
    CANDIDATES_PER_ARTIST,
  );
  const tracks = await buildEpisodeTracks(
    candidates,
    alreadyUsedTrackIds,
    deps.itunes,
    tracksPerEpisode,
  );
  console.log(`${tracks.length} morceaux sélectionnés avec extrait audio résolu.`);

  const outputPath = `${deps.outputDir}/${channel.id}-${theme.id}-${Date.now()}.mp4`;
  await renderEpisode({ tracks, outputPath });
  console.log(`Vidéo rendue : ${outputPath}`);

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

  try {
    const episodeNumber = countVideosForTheme(db, theme.id);
    const { title, description, tags } = buildYoutubeMetadata(theme, episodeNumber);

    const { videoId: youtubeVideoId } = await deps.youtube.uploadVideo({
      filePath: outputPath,
      title,
      description,
      tags,
      visibility: channel.visibility,
    });

    let playlistId = getPlaylistId(db, theme.id);
    if (!playlistId) {
      playlistId = (await deps.youtube.ensurePlaylist(theme.label)).playlistId;
      setPlaylistId(db, theme.id, playlistId);
    }
    await deps.youtube.addVideoToPlaylist(youtubeVideoId, playlistId);

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

    console.log(`Publiée sur YouTube : https://youtu.be/${youtubeVideoId}`);
  } catch (error) {
    markVideoFailed(db, videoId);
    throw error;
  }
}
