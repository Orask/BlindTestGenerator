import { randomUUID } from "node:crypto";
import { createVideo, markVideoUploaded } from "@blindtest/db";
import type { YoutubeClient } from "@blindtest/youtube";
import type Database from "better-sqlite3";
import { renderShort, type RenderShortTrack } from "../render-short.js";
import type { YoutubeMetadata } from "../youtube-metadata.js";

export interface PublishShortParams {
  readonly db: Database.Database;
  readonly serveUrl: string;
  readonly themeLabel: string;
  readonly tracks: readonly RenderShortTrack[];
  /** Omitted for a Short that doesn't tease a specific episode — see ShortOutro's own doc comment. */
  readonly fullEpisodeTrackCount?: number;
  readonly outputPath: string;
  readonly channelId: string;
  readonly themeId: string;
  readonly visibility: "private" | "unlisted" | "public";
  readonly upload: boolean;
  readonly youtube: YoutubeClient;
  readonly metadata: YoutubeMetadata;
}

export interface PublishShortResult {
  readonly outputPath: string;
  readonly youtubeVideoId?: string;
}

/**
 * The render/upload/bookkeeping tail every Family A CLI script shares, once
 * it has already picked its own tracks and built its own metadata — see
 * devine-la-chanson.ts/pepite-meconnue.ts/top-artiste.ts/anniversaire-
 * sortie.ts, which each differ in *which* tracks and *what* metadata, never
 * in what happens once both are decided. Extracted from generate-short.ts's
 * original inline version so the 3 newer CLI scripts don't duplicate it.
 *
 * Deliberately does NOT call recordTrackUsage: every Family A type only
 * reuses tracks the long-form pipeline (or a previous Short) already
 * recorded, so calling it again here would double-count a track that was
 * never independently selected.
 */
export async function publishShort(params: PublishShortParams): Promise<PublishShortResult> {
  await renderShort({
    serveUrl: params.serveUrl,
    themeLabel: params.themeLabel,
    tracks: params.tracks,
    outputPath: params.outputPath,
    ...(params.fullEpisodeTrackCount !== undefined
      ? { fullEpisodeTrackCount: params.fullEpisodeTrackCount }
      : {}),
  });
  console.log(`Short rendu : ${params.outputPath}`);

  if (!params.upload) {
    console.log("Pas d'upload demandé (ajoute --upload pour publier sur YouTube).");
    return { outputPath: params.outputPath };
  }

  const { videoId: youtubeVideoId } = await params.youtube.uploadVideo({
    filePath: params.outputPath,
    title: params.metadata.title,
    description: params.metadata.description,
    tags: params.metadata.tags,
    visibility: params.visibility,
  });

  const shortVideoRowId = randomUUID();
  createVideo(params.db, {
    id: shortVideoRowId,
    channelId: params.channelId,
    themeId: params.themeId,
    createdAt: new Date(),
    filePath: params.outputPath,
    visibility: params.visibility,
    format: "short",
  });
  markVideoUploaded(params.db, shortVideoRowId, youtubeVideoId);

  console.log(`Short publié : https://youtube.com/shorts/${youtubeVideoId}`);
  return { outputPath: params.outputPath, youtubeVideoId };
}
