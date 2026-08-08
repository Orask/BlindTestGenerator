import { bundle } from "@remotion/bundler";
import { VIDEO_RENDERER_ENTRY } from "./video-renderer-paths.js";

// Caching (on by default) can serve a stale bundle whose public/ dir
// snapshot predates that day's freshly-downloaded cover images — this is a
// once-a-day job, so the extra bundling time doesn't matter. Bundled once
// per pipeline run and shared between the episode and thumbnail renders
// rather than bundling twice.
export async function bundleVideoRenderer(): Promise<string> {
  return bundle({ entryPoint: VIDEO_RENDERER_ENTRY, enableCaching: false });
}
