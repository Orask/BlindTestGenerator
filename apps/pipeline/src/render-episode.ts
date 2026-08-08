import { renderMedia, selectComposition } from "@remotion/renderer";
import type { EpisodeTrack } from "./build-episode-tracks.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";

export interface RenderEpisodeParams {
  readonly serveUrl: string;
  readonly themeLabel: string;
  readonly tracks: readonly EpisodeTrack[];
  readonly outputPath: string;
}

export async function renderEpisode(params: RenderEpisodeParams): Promise<void> {
  const coverUrls = params.tracks.map((track) => track.albumCoverUrl);
  const publicCoverUrls = await resolvePublicCoverUrls(coverUrls, PUBLIC_COVERS_DIR);

  // No GPU in this sandboxed environment — swiftshader is Chrome's software
  // GL renderer, and a longer timeout avoids false "initial render" timeouts
  // on a slow/cold headless Chrome start.
  const chromiumOptions = { gl: "swiftshader" as const };
  const timeoutInMilliseconds = 180_000;

  const serveUrl = params.serveUrl;

  const inputProps = {
    themeLabel: params.themeLabel,
    tracks: params.tracks.map((track) => ({
      title: track.title,
      artist: track.artist,
      albumCoverUrl: publicCoverUrls.get(track.albumCoverUrl) ?? track.albumCoverUrl,
      audioUrl: track.audioUrl,
    })),
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
