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
// Recalibrated again (2026-10-12, real YouTube Analytics this time, not
// just retention research): 2 tracks at the long-form's 17s/track pacing
// barely registered any views — viewers expect short-form to be fast, not
// a slow-motion copy of the long-form guessing game. 6 tracks at the
// Short-specific 5s/track pacing (constants.ts — 3s countdown + 2s reveal,
// not the long-form's 12+5) keeps total length similar (~34s with the
// outro) but far more dynamic: 6 distinct songs instead of 2.
const DEFAULT_SHORT_TRACK_COUNT = 6;

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

// status = 'uploaded' only: a stale 'failed' row left behind by an
// earlier crashed run (nothing ever deletes those — see
// countVideosForTheme's doc comment in @blindtest/db) would otherwise
// inflate this count, same bug, same fix.
const episodeNumberRow = db
  .prepare(
    "SELECT COUNT(*) AS count FROM videos WHERE theme_id = ? AND status = 'uploaded' AND created_at <= (SELECT created_at FROM videos WHERE id = ?)",
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
  dbPath,
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
