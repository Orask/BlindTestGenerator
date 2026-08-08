import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { EpisodeTrack } from "./build-episode-tracks.js";
import { downloadCoverImages } from "./download-cover-images.js";

// Remotion bundles by file path, not through normal package resolution, so
// video-renderer's entry is referenced directly rather than as a dependency.
const VIDEO_RENDERER_ENTRY = fileURLToPath(
  new URL("../../../packages/video-renderer/src/index.ts", import.meta.url),
);

// Downloaded covers land in video-renderer's own public/ dir so Remotion's
// dev server serves them over http(s) alongside the bundle — file:// URLs
// are flatly refused by Chromium (ERR_UNKNOWN_URL_SCHEME) even from a page
// served over http://localhost, disableWebSecurity or not.
const PUBLIC_COVERS_DIR = fileURLToPath(
  new URL("../../../packages/video-renderer/public/covers", import.meta.url),
);

export interface RenderEpisodeParams {
  readonly themeLabel: string;
  readonly tracks: readonly EpisodeTrack[];
  readonly outputPath: string;
}

export async function renderEpisode(params: RenderEpisodeParams): Promise<void> {
  const coverUrls = params.tracks.map((track) => track.albumCoverUrl);
  const localCovers = await downloadCoverImages(coverUrls, PUBLIC_COVERS_DIR);

  // No GPU in this sandboxed environment — swiftshader is Chrome's software
  // GL renderer, and a longer timeout avoids false "initial render" timeouts
  // on a slow/cold headless Chrome start.
  const chromiumOptions = { gl: "swiftshader" as const };
  const timeoutInMilliseconds = 180_000;

  // Caching (on by default) can serve a stale bundle whose public/ dir
  // snapshot predates that day's freshly-downloaded cover images — this is
  // a once-a-day job, so the extra bundling time doesn't matter.
  const serveUrl = await bundle({ entryPoint: VIDEO_RENDERER_ENTRY, enableCaching: false });

  const inputProps = {
    themeLabel: params.themeLabel,
    tracks: params.tracks.map((track) => {
      const localPath = localCovers.get(track.albumCoverUrl);
      // Root-relative, matching what staticFile() produces: the bundle
      // serves the public/ dir under a /public prefix, not merged into the
      // server root, confirmed by inspecting an actual bundle output dir.
      const albumCoverUrl = localPath
        ? `/public/covers/${path.basename(localPath)}`
        : track.albumCoverUrl;
      return {
        title: track.title,
        artist: track.artist,
        albumCoverUrl,
        audioUrl: track.audioUrl,
      };
    }),
  };

  const composition = await selectComposition({
    serveUrl,
    id: "Episode",
    inputProps,
    chromiumOptions,
    timeoutInMilliseconds,
  });

  let lastLoggedFrame = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: params.outputPath,
    inputProps,
    chromiumOptions,
    timeoutInMilliseconds,
    onProgress: ({ renderedFrames }) => {
      const bucket = Math.floor(renderedFrames / 60) * 60;
      if (bucket !== lastLoggedFrame) {
        lastLoggedFrame = bucket;
        console.log(`Rendu: ${renderedFrames}/${composition.durationInFrames} frames`);
      }
    },
  });
}
