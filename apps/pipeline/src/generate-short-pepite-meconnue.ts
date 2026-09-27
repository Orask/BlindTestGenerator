import { fileURLToPath } from "node:url";
import { openDatabase } from "@blindtest/db";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { createClientsFromEnv } from "./create-clients.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { findThemeOrThrow } from "./find-theme-by-id.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { selectPepiteMeconnueTracks } from "./shorts/pepite-meconnue.js";
import { publishShort } from "./shorts/publish-short.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";
import { buildPepiteMeconnueMetadata } from "./youtube-metadata.js";

// Family A, type 2: same already-published episode as generate-short.ts,
// but its LEAST popular tracks instead of the opening hook — "hidden gems
// you probably missed" instead of "guess the obvious ones". See
// shorts/pepite-meconnue.ts for the selection logic and its cost note (one
// Spotify call per track in the episode, not just the ones used here).
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
    "Usage: generate-short-pepite-meconnue <channel-config.json> <long-video-row-id> [--track-count=2] [--upload]\n" +
      "Cuts a vertical Short from an already-published long episode's LEAST popular tracks.\n" +
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

const channel = await loadChannelConfig(channelConfigPath);
const theme = findThemeOrThrow(channel, longVideoRow.theme_id);

const { spotify, itunes, youtube } = createClientsFromEnv();

console.log(`Recherche des ${shortTrackCount} morceau(x) les moins populaires de l'épisode...`);
const tracks = await selectPepiteMeconnueTracks(
  db,
  spotify,
  itunes,
  longVideoRowId,
  shortTrackCount,
);
if (tracks.length === 0) {
  throw new Error(`Aucun morceau exploitable trouvé pour la vidéo ${longVideoRowId}`);
}

const runId = Date.now();
const outputDir = fileURLToPath(new URL("../../../data/renders/", import.meta.url));
const outputPath = `${outputDir}${channel.id}-${theme.id}-${runId}-pepite-meconnue.mp4`;

const metadata = buildPepiteMeconnueMetadata(theme, tracks);

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
  outputPath,
  channelId: longVideoRow.channel_id,
  themeId: longVideoRow.theme_id,
  visibility: longVideoRow.visibility,
  upload,
  youtube,
  metadata,
});
