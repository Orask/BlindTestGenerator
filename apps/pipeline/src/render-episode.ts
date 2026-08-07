import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { EpisodeTrack } from "./build-episode-tracks.js";

// Remotion bundles by file path, not through normal package resolution, so
// video-renderer's entry is referenced directly rather than as a dependency.
const VIDEO_RENDERER_ENTRY = fileURLToPath(
  new URL("../../../packages/video-renderer/src/index.ts", import.meta.url),
);

export interface RenderEpisodeParams {
  readonly themeLabel: string;
  readonly tracks: readonly EpisodeTrack[];
  readonly outputPath: string;
}

export async function renderEpisode(params: RenderEpisodeParams): Promise<void> {
  const inputProps = {
    themeLabel: params.themeLabel,
    tracks: params.tracks.map((track) => ({
      title: track.title,
      artist: track.artist,
      albumCoverUrl: track.albumCoverUrl,
      audioUrl: track.audioUrl,
    })),
  };

  // No GPU in this sandboxed environment — swiftshader is Chrome's software
  // GL renderer, and a longer timeout avoids false "initial render" timeouts
  // on a slow/cold headless Chrome start.
  const chromiumOptions = { gl: "swiftshader" as const };
  const timeoutInMilliseconds = 120_000;

  const serveUrl = await bundle({ entryPoint: VIDEO_RENDERER_ENTRY });
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
