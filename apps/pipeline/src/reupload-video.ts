import { fileURLToPath } from "node:url";
import { getPlaylistId, markVideoUploaded, openDatabase, setPlaylistId } from "@blindtest/db";
import { createClientsFromEnv } from "./create-clients.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { buildYoutubeMetadata } from "./youtube-metadata.js";

// One-off: re-uploads an already-rendered episode whose first YouTube upload
// was rejected (account not yet verified for videos over 15 minutes), reusing
// the same rendered file and track list instead of re-running the whole
// pipeline (which would burn a fresh iTunes-throttled selection + render).
const [channelConfigPath, videoId] = process.argv.slice(2);
if (!channelConfigPath || !videoId) {
  console.error("Usage: reupload-video <channel-config.json> <video-row-id>");
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);

const videoRow = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId) as
  | { theme_id: string; file_path: string; visibility: "private" | "unlisted" | "public" }
  | undefined;
if (!videoRow) {
  throw new Error(`No video row found with id ${videoId}`);
}

const trackRows = db
  .prepare("SELECT title, artist FROM tracks_used WHERE video_id = ? ORDER BY rowid")
  .all(videoId) as { title: string; artist: string }[];
if (trackRows.length === 0) {
  throw new Error(`No tracks_used rows found for video ${videoId}`);
}

const channel = await loadChannelConfig(channelConfigPath);
const theme = channel.themes.find((candidate) => candidate.id === videoRow.theme_id);
if (!theme) {
  throw new Error(`Theme ${videoRow.theme_id} not found in channel config`);
}

const episodeNumberRow = db
  .prepare(
    "SELECT COUNT(*) AS count FROM videos WHERE theme_id = ? AND created_at <= (SELECT created_at FROM videos WHERE id = ?)",
  )
  .get(videoRow.theme_id, videoId) as { count: number };

const { title, description, tags } = buildYoutubeMetadata(theme, episodeNumberRow.count, trackRows);

const { youtube } = createClientsFromEnv();

const { videoId: youtubeVideoId } = await youtube.uploadVideo({
  filePath: videoRow.file_path,
  title,
  description,
  tags,
  visibility: videoRow.visibility,
});

let playlistId = getPlaylistId(db, theme.id);
if (!playlistId) {
  playlistId = (await youtube.ensurePlaylist(theme.label)).playlistId;
  setPlaylistId(db, theme.id, playlistId);
}
await youtube.addVideoToPlaylist(youtubeVideoId, playlistId);

markVideoUploaded(db, videoId, youtubeVideoId);

console.log(`Republiée sur YouTube : https://youtu.be/${youtubeVideoId}`);
