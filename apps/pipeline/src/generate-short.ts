import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createVideo, markVideoUploaded, openDatabase } from "@blindtest/db";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { createClientsFromEnv } from "./create-clients.js";
import { findThemeOrThrow } from "./find-theme-by-id.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { renderShort, type RenderShortTrack } from "./render-short.js";
import { buildShortMetadata } from "./youtube-metadata.js";

// One-off / cron-able: cuts a vertical YouTube Short from an already-
// published long episode's *opening* tracks — cheap to prototype since
// buildOpeningHook (build-episode-tracks.ts) already reordered that episode
// so its first few tracks are its strongest, most recognizable draws; a
// Short just needs to borrow that ordering; it doesn't pick anything new.
// Deliberately does NOT call recordTrackUsage: these tracks already counted
// against the reuse-cooldown/anti-repeat history when the long episode used
// them, and a Short reusing that same footage isn't a second, independent
// use of the track — recording it again would double-count it.
const ITUNES_LOOKUP_DELAY_MS = 3500;
const DEFAULT_SHORT_TRACK_COUNT = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const args = process.argv.slice(2);
const [channelConfigPath, longVideoRowId] = args;
const upload = args.includes("--upload");
const trackCountArg = args.find((arg) => arg.startsWith("--track-count="));
const shortTrackCount = trackCountArg
  ? Number(trackCountArg.slice("--track-count=".length))
  : DEFAULT_SHORT_TRACK_COUNT;

if (
  !channelConfigPath ||
  !longVideoRowId ||
  !Number.isInteger(shortTrackCount) ||
  shortTrackCount < 1
) {
  console.error(
    "Usage: generate-short <channel-config.json> <long-video-row-id> [--track-count=5] [--upload]\n" +
      "Cuts a vertical Short from an already-published long episode's opening tracks.\n" +
      "Renders locally by default; pass --upload to also publish it to YouTube (format='short').",
  );
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);

const longVideoRow = db.prepare("SELECT * FROM videos WHERE id = ?").get(longVideoRowId) as
  | {
      channel_id: string;
      theme_id: string;
      visibility: "private" | "unlisted" | "public";
    }
  | undefined;
if (!longVideoRow) {
  throw new Error(`No video row found with id ${longVideoRowId}`);
}

const trackRows = db
  .prepare(
    "SELECT spotify_track_id, title, artist FROM tracks_used WHERE video_id = ? ORDER BY rowid LIMIT ?",
  )
  .all(longVideoRowId, shortTrackCount) as {
  spotify_track_id: string;
  title: string;
  artist: string;
}[];
if (trackRows.length === 0) {
  throw new Error(`No tracks_used rows found for video ${longVideoRowId}`);
}

const fullEpisodeTrackCountRow = db
  .prepare("SELECT COUNT(*) AS count FROM tracks_used WHERE video_id = ?")
  .get(longVideoRowId) as { count: number };

const channel = await loadChannelConfig(channelConfigPath);
const theme = findThemeOrThrow(channel, longVideoRow.theme_id);

const { spotify, itunes, youtube } = createClientsFromEnv();

console.log(`Ré-hydratation de ${trackRows.length} morceau(x) pour le short...`);
const tracks: RenderShortTrack[] = [];
for (const row of trackRows) {
  const metadata = await spotify.getTrackById(row.spotify_track_id);
  const preview = await itunes.findPreviewByTitleAndArtist(row.title, row.artist);
  await sleep(ITUNES_LOOKUP_DELAY_MS);
  if (!preview) {
    throw new Error(`Aucun extrait iTunes retrouvé pour "${row.title}" — ${row.artist}`);
  }
  tracks.push({
    title: row.title,
    artist: row.artist,
    albumCoverUrl: metadata.albumCoverUrl,
    audioUrl: preview.previewUrl,
  });
}

const runId = Date.now();
const outputDir = fileURLToPath(new URL("../../../data/renders/", import.meta.url));
const outputPath = `${outputDir}${channel.id}-${theme.id}-${runId}-short.mp4`;

const serveUrl = await bundleVideoRenderer();
await renderShort({
  serveUrl,
  themeLabel: theme.label,
  tracks,
  fullEpisodeTrackCount: fullEpisodeTrackCountRow.count,
  outputPath,
});
console.log(`Short rendu : ${outputPath}`);

if (!upload) {
  console.log("Pas d'upload demandé (ajoute --upload pour publier sur YouTube).");
  process.exit(0);
}

const episodeNumberRow = db
  .prepare(
    "SELECT COUNT(*) AS count FROM videos WHERE theme_id = ? AND created_at <= (SELECT created_at FROM videos WHERE id = ?)",
  )
  .get(longVideoRow.theme_id, longVideoRowId) as { count: number };

const { title, description, tags } = buildShortMetadata(
  theme,
  episodeNumberRow.count,
  tracks.length,
  fullEpisodeTrackCountRow.count,
);

const { videoId: youtubeVideoId } = await youtube.uploadVideo({
  filePath: outputPath,
  title,
  description,
  tags,
  visibility: longVideoRow.visibility,
});

const shortVideoRowId = randomUUID();
createVideo(db, {
  id: shortVideoRowId,
  channelId: longVideoRow.channel_id,
  themeId: longVideoRow.theme_id,
  createdAt: new Date(),
  filePath: outputPath,
  visibility: longVideoRow.visibility,
  format: "short",
});
markVideoUploaded(db, shortVideoRowId, youtubeVideoId);

console.log(`Short publié : https://youtube.com/shorts/${youtubeVideoId}`);
