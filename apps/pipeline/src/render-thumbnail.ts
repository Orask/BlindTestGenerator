import { readdir } from "node:fs/promises";
import { renderStill, selectComposition } from "@remotion/renderer";
import type { EpisodeTrack } from "./build-episode-tracks.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";

// Enough to fill the Thumbnail composition's grid with real variety without
// pulling in the full episode (tracks are already artist-diversified by
// spreadOutArtists, so the first N still span most featured artists).
const THUMBNAIL_COVER_COUNT = 24;

export interface RenderThumbnailStillParams {
  readonly serveUrl: string;
  readonly themeLabel: string;
  readonly trackCount: number;
  /** Already resolved to root-relative /public/covers/... URLs. */
  readonly coverImageUrls: readonly string[];
  readonly outputPath: string;
}

// Split from renderThumbnail() so a recovery flow can render a thumbnail
// from covers already cached on disk (e.g. reupload-video.ts), without
// needing full EpisodeTrack objects it doesn't have.
export async function renderThumbnailStill(params: RenderThumbnailStillParams): Promise<void> {
  const chromiumOptions = { gl: "swiftshader" as const };
  const timeoutInMilliseconds = 60_000;

  const inputProps = {
    themeLabel: params.themeLabel,
    trackCount: params.trackCount,
    coverImageUrls: params.coverImageUrls,
  };

  const composition = await selectComposition({
    serveUrl: params.serveUrl,
    id: "Thumbnail",
    inputProps,
    chromiumOptions,
    timeoutInMilliseconds,
  });

  await renderStill({
    composition,
    serveUrl: params.serveUrl,
    output: params.outputPath,
    inputProps,
    chromiumOptions,
    timeoutInMilliseconds,
  });
}

export interface RenderThumbnailParams {
  readonly serveUrl: string;
  readonly themeLabel: string;
  readonly tracks: readonly EpisodeTrack[];
  readonly outputPath: string;
}

export async function renderThumbnail(params: RenderThumbnailParams): Promise<void> {
  const coverUrls = params.tracks
    .map((track) => track.albumCoverUrl)
    .slice(0, THUMBNAIL_COVER_COUNT);
  const publicCoverUrls = await resolvePublicCoverUrls(coverUrls, PUBLIC_COVERS_DIR);

  await renderThumbnailStill({
    serveUrl: params.serveUrl,
    themeLabel: params.themeLabel,
    trackCount: params.tracks.length,
    coverImageUrls: coverUrls.map((url) => publicCoverUrls.get(url) ?? url),
    outputPath: params.outputPath,
  });
}

export interface RenderThumbnailFromCacheParams {
  readonly serveUrl: string;
  readonly themeLabel: string;
  readonly trackCount: number;
  readonly outputPath: string;
}

// For recovery scripts that only have a video row (no EpisodeTrack objects):
// reuses whatever covers are still on disk from that episode's original
// render instead of re-downloading them.
export async function renderThumbnailFromCache(
  params: RenderThumbnailFromCacheParams,
): Promise<void> {
  const cachedCoverFiles = (await readdir(PUBLIC_COVERS_DIR)).slice(0, THUMBNAIL_COVER_COUNT);
  if (cachedCoverFiles.length === 0) {
    throw new Error(
      `No cached cover images found in ${PUBLIC_COVERS_DIR} — cannot build a thumbnail.`,
    );
  }

  await renderThumbnailStill({
    serveUrl: params.serveUrl,
    themeLabel: params.themeLabel,
    trackCount: params.trackCount,
    coverImageUrls: cachedCoverFiles.map((fileName) => `/public/covers/${fileName}`),
    outputPath: params.outputPath,
  });
}
