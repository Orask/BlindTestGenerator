import { fileURLToPath } from "node:url";

// Remotion bundles by file path, not through normal package resolution, so
// video-renderer's entry is referenced directly rather than as a dependency.
export const VIDEO_RENDERER_ENTRY = fileURLToPath(
  new URL("../../../packages/video-renderer/src/index.ts", import.meta.url),
);

// Downloaded covers land in video-renderer's own public/ dir so Remotion's
// dev server serves them over http(s) alongside the bundle — file:// URLs
// are flatly refused by Chromium (ERR_UNKNOWN_URL_SCHEME) even from a page
// served over http://localhost, disableWebSecurity or not.
export const PUBLIC_COVERS_DIR = fileURLToPath(
  new URL("../../../packages/video-renderer/public/covers", import.meta.url),
);
