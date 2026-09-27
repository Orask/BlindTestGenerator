import { renderMedia, selectComposition } from "@remotion/renderer";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";

export interface RenderShortTrack {
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
  readonly audioUrl: string;
}

export interface RenderShortParams {
  readonly serveUrl: string;
  readonly themeLabel: string;
  readonly tracks: readonly RenderShortTrack[];
  readonly fullEpisodeTrackCount: number;
  readonly outputPath: string;
  /** See renderEpisode's own doc comment — same reasoning applies here. */
  readonly concurrency?: number;
}

// Mirrors render-episode.ts's renderEpisode, for the vertical "Short"
// composition instead of "Episode" — same cover-download-then-render
// pattern (Remotion's <Img>/<Video> can't load Spotify's CDN reliably, see
// download-cover-images.ts), same swiftshader/timeout tuning for a
// GPU-less render host.
export async function renderShort(params: RenderShortParams): Promise<void> {
  const coverUrls = params.tracks.map((track) => track.albumCoverUrl);
  const publicCoverUrls = await resolvePublicCoverUrls(coverUrls, PUBLIC_COVERS_DIR);

  const chromiumOptions = { gl: "swiftshader" as const };
  const timeoutInMilliseconds = 180_000;

  const inputProps = {
    themeLabel: params.themeLabel,
    fullEpisodeTrackCount: params.fullEpisodeTrackCount,
    tracks: params.tracks.map((track) => ({
      title: track.title,
      artist: track.artist,
      albumCoverUrl: publicCoverUrls.get(track.albumCoverUrl) ?? track.albumCoverUrl,
      audioUrl: track.audioUrl,
    })),
  };

  const composition = await selectComposition({
    serveUrl: params.serveUrl,
    id: "Short",
    inputProps,
    chromiumOptions,
    timeoutInMilliseconds,
  });

  let lastLoggedFrame = -1;
  await renderMedia({
    composition,
    serveUrl: params.serveUrl,
    codec: "h264",
    outputLocation: params.outputPath,
    inputProps,
    chromiumOptions,
    timeoutInMilliseconds,
    ...(params.concurrency !== undefined ? { concurrency: params.concurrency } : {}),
    onProgress: ({ renderedFrames }) => {
      const bucket = Math.floor(renderedFrames / 60) * 60;
      if (bucket !== lastLoggedFrame) {
        lastLoggedFrame = bucket;
        console.log(`Rendu short: ${renderedFrames}/${composition.durationInFrames} frames`);
      }
    },
  });
}
