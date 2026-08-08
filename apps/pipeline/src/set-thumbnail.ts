import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "@blindtest/db";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { createClientsFromEnv } from "./create-clients.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { renderThumbnailFromCache } from "./render-thumbnail.js";

// One-off: (re)generates and applies a thumbnail to an already-uploaded
// video without re-uploading the video file itself — for applying the new
// thumbnail feature to an episode that was published before it existed.
const [channelConfigPath, videoId] = process.argv.slice(2);
if (!channelConfigPath || !videoId) {
  console.error("Usage: set-thumbnail <channel-config.json> <video-row-id>");
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);

const videoRow = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId) as
  { theme_id: string; file_path: string; youtube_video_id: string | null } | undefined;
if (!videoRow) {
  throw new Error(`No video row found with id ${videoId}`);
}
if (!videoRow.youtube_video_id) {
  throw new Error(`Video ${videoId} has no youtube_video_id — it hasn't been uploaded yet.`);
}

const trackCountRow = db
  .prepare("SELECT COUNT(*) AS count FROM tracks_used WHERE video_id = ?")
  .get(videoId) as { count: number };

const channel = await loadChannelConfig(channelConfigPath);
const theme = channel.themes.find((candidate) => candidate.id === videoRow.theme_id);
if (!theme) {
  throw new Error(`Theme ${videoRow.theme_id} not found in channel config`);
}

const thumbnailPath = path.join(path.dirname(videoRow.file_path), `${videoId}-thumbnail.jpg`);
const serveUrl = await bundleVideoRenderer();
await renderThumbnailFromCache({
  serveUrl,
  themeLabel: theme.label,
  trackCount: trackCountRow.count,
  outputPath: thumbnailPath,
});
console.log(`Miniature rendue : ${thumbnailPath}`);

const { youtube } = createClientsFromEnv();
await youtube.setThumbnail(videoRow.youtube_video_id, thumbnailPath);

console.log(`Miniature appliquée à https://youtu.be/${videoRow.youtube_video_id}`);
