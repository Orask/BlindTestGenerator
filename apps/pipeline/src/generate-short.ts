import { fileURLToPath } from "node:url";
import { openDatabase } from "@blindtest/db";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { createClientsFromEnv } from "./create-clients.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { findThemeOrThrow } from "./find-theme-by-id.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { publishShort } from "./shorts/publish-short.js";
import { selectDevineLaChansonTracks } from "./shorts/devine-la-chanson.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";
import { buildShortMetadata } from "./youtube-metadata.js";

// One-off / cron-able: cuts a vertical YouTube Short from an already-
// published long episode's *most recognizable* tracks (scored via Deezer's
// rank, see shorts/popularity-signal.ts — not the episode's opening-hook
// order, which only compares popularity within each artist's own search
// results, not across the whole episode).
// Track selection lives in shorts/devine-la-chanson.ts (Family A, type 1) —
// this script is now just its CLI wrapper, same shape as the 3 other
// Family A CLI scripts (generate-short-pepite-meconnue.ts, -top-artiste.ts,
// -anniversaire.ts).
// Recalibrated from 5 (session of 2026-09-27, never checked against real
// retention data) to 2 — 2026 Shorts research says completion rate, not
// duration, drives distribution, and the sweet spot is 15-30s (secondary
// peak 35-58s, reserved for narrative-dense niches this quiz format isn't).
// 2 tracks ≈ 38s including the outro, solidly in that range; 5 tracks was
// ~94s, well past it. See docs/CLOUD_SESSION_LOG.md for the full research.
const DEFAULT_SHORT_TRACK_COUNT = 2;

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

const fullEpisodeTrackCountRow = db
  .prepare("SELECT COUNT(*) AS count FROM tracks_used WHERE video_id = ?")
  .get(longVideoRowId) as { count: number };

const channel = await loadChannelConfig(channelConfigPath);
const theme = findThemeOrThrow(channel, longVideoRow.theme_id);

const { spotify, deezer, itunes, youtube } = createClientsFromEnv();

console.log(`Ré-hydratation de ${shortTrackCount} morceau(x) pour le short...`);
const tracks = await selectDevineLaChansonTracks(
  db,
  spotify,
  deezer,
  itunes,
  longVideoRowId,
  shortTrackCount,
);
if (tracks.length === 0) {
  throw new Error(`Aucun morceau exploitable trouvé pour la vidéo ${longVideoRowId}`);
}

const runId = Date.now();
const outputDir = fileURLToPath(new URL("../../../data/renders/", import.meta.url));
const outputPath = `${outputDir}${channel.id}-${theme.id}-${runId}-short.mp4`;

const episodeNumberRow = db
  .prepare(
    "SELECT COUNT(*) AS count FROM videos WHERE theme_id = ? AND created_at <= (SELECT created_at FROM videos WHERE id = ?)",
  )
  .get(longVideoRow.theme_id, longVideoRowId) as { count: number };

const metadata = buildShortMetadata(
  theme,
  episodeNumberRow.count,
  tracks.length,
  fullEpisodeTrackCountRow.count,
);

// Covers must land on disk BEFORE bundling: Remotion's bundler snapshots
// public/ at bundle time, so anything downloaded afterward 404s from the
// bundled server (same fix as pipeline.ts — see its comment).
await resolvePublicCoverUrls(
  tracks.map((track) => track.albumCoverUrl),
  PUBLIC_COVERS_DIR,
);
const serveUrl = await bundleVideoRenderer();
await publishShort({
  db,
  serveUrl,
  themeLabel: theme.label,
  tracks,
  fullEpisodeTrackCount: fullEpisodeTrackCountRow.count,
  outputPath,
  channelId: longVideoRow.channel_id,
  themeId: longVideoRow.theme_id,
  visibility: longVideoRow.visibility,
  upload,
  youtube,
  metadata,
});
