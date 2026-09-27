import { readdir } from "node:fs/promises";
import { renderStill, selectComposition } from "@remotion/renderer";
import type { SpotifyClient } from "@blindtest/spotify";
import type { EpisodeTrack } from "./build-episode-tracks.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { PUBLIC_ARTISTS_DIR, PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";

// Enough to fill the Thumbnail composition's grid with real variety without
// pulling in the full episode (tracks are already artist-diversified by
// spreadOutArtists, so the first N still span most featured artists).
const THUMBNAIL_COVER_COUNT = 24;

// The hero visual: real faces read as "guessable content" from a preview
// thumbnail size in a way tiny cover art never does (confirmed by every
// high-performing blind-test thumbnail we looked at — see the design
// discussion this was built from). Capped low because each one has to stay
// large enough to actually be recognizable, not because more wouldn't help.
const THUMBNAIL_ARTIST_COUNT = 6;

export interface RenderThumbnailStillParams {
  readonly serveUrl: string;
  readonly themeLabel: string;
  readonly trackCount: number;
  /** Already resolved to root-relative /public/covers/... URLs. */
  readonly coverImageUrls: readonly string[];
  /** Already resolved to root-relative /public/artists/... URLs. */
  readonly artistImageUrls: readonly string[];
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
    artistImageUrls: params.artistImageUrls,
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
  readonly spotify: SpotifyClient;
}

/**
 * The episode's most prominent distinct artists, in track order (tracks are
 * already popularity-ordered by buildOpeningHook and artist-spaced by
 * spreadOutArtists, so the first few names are naturally the strongest
 * draws). Live-verified one at a time rather than assumed: an artist with no
 * Spotify portrait (common for orchestras/composer credits) is skipped
 * rather than leaving a gap in the thumbnail.
 */
async function resolveHeroArtistImages(
  spotify: SpotifyClient,
  tracks: readonly EpisodeTrack[],
): Promise<string[]> {
  const seen = new Set<string>();
  const images: string[] = [];
  for (const track of tracks) {
    if (images.length >= THUMBNAIL_ARTIST_COUNT) {
      break;
    }
    const name = track.artistNames[0];
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    const image = await spotify.getArtistImage(name);
    if (image) {
      images.push(image);
    }
  }
  return images;
}

export async function renderThumbnail(params: RenderThumbnailParams): Promise<void> {
  const coverUrls = params.tracks
    .map((track) => track.albumCoverUrl)
    .slice(0, THUMBNAIL_COVER_COUNT);
  const publicCoverUrls = await resolvePublicCoverUrls(coverUrls, PUBLIC_COVERS_DIR);

  const artistUrls = await resolveHeroArtistImages(params.spotify, params.tracks);
  const publicArtistUrls = await resolvePublicCoverUrls(artistUrls, PUBLIC_ARTISTS_DIR, "artists");

  await renderThumbnailStill({
    serveUrl: params.serveUrl,
    themeLabel: params.themeLabel,
    trackCount: params.tracks.length,
    coverImageUrls: coverUrls.map((url) => publicCoverUrls.get(url) ?? url),
    artistImageUrls: artistUrls.map((url) => publicArtistUrls.get(url) ?? url),
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
    // No EpisodeTrack objects available here to resolve artist photos from
    // — falls back to the cover-grid-only look, same as before this feature.
    artistImageUrls: [],
    outputPath: params.outputPath,
  });
}
