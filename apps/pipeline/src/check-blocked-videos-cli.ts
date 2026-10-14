import { fileURLToPath } from "node:url";
import { openDatabase } from "@blindtest/db";
import { createClientsFromEnv } from "./create-clients.js";
import { findBlockedVideos, type UploadedVideoRow } from "./find-blocked-videos.js";

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);

const rows = db
  .prepare(
    `SELECT id, channel_id AS channelId, theme_id AS themeId,
            youtube_video_id AS youtubeVideoId, created_at AS createdAt
     FROM videos
     WHERE status = 'uploaded' AND youtube_video_id IS NOT NULL`,
  )
  .all() as UploadedVideoRow[];

console.log(`Vérification de ${rows.length} vidéo(s) publiée(s)...`);

const { youtube } = createClientsFromEnv();
const blocked = await findBlockedVideos(youtube, rows);

if (blocked.length === 0) {
  console.log("Aucune vidéo bloquée mondialement détectée.");
  process.exit(0);
}

console.error(`${blocked.length} vidéo(s) bloquée(s) mondialement détectée(s) :`);
for (const video of blocked) {
  console.error(
    `  - https://youtu.be/${video.youtubeVideoId} ` +
      `(${video.channelId}/${video.themeId}, publiée le ${video.createdAt}, ` +
      `bloquée dans ${video.blockedRegionCount} région(s))`,
  );
}
console.error(
  "\nOuvre YouTube Studio > Détection de contenus pour identifier le morceau fautif " +
    "(l'API publique ne l'expose pas), puis lance replace-blocked-tracks.ts.",
);
process.exitCode = 1;
