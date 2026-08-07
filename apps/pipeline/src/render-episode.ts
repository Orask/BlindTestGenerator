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
  readonly tracks: readonly EpisodeTrack[];
  readonly outputPath: string;
}

export async function renderEpisode(params: RenderEpisodeParams): Promise<void> {
  const inputProps = {
    tracks: params.tracks.map((track) => ({
      title: track.title,
      artist: track.artist,
      albumCoverUrl: track.albumCoverUrl,
      audioUrl: track.audioUrl,
    })),
  };

  const serveUrl = await bundle({ entryPoint: VIDEO_RENDERER_ENTRY });
  const composition = await selectComposition({ serveUrl, id: "Episode", inputProps });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: params.outputPath,
    inputProps,
  });
}
