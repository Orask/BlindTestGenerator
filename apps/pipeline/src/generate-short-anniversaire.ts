import { fileURLToPath } from "node:url";
import { openDatabase } from "@blindtest/db";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { createClientsFromEnv } from "./create-clients.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { findAnniversaryMatches, hydrateAnniversaryTrack } from "./shorts/anniversaire-sortie.js";
import { publishShort } from "./shorts/publish-short.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";
import { buildAnniversaireSortieMetadata } from "./youtube-metadata.js";

// Family A, type 4: "this track came out N years ago today" — see
// shorts/anniversaire-sortie.ts for the matching logic. Channel-wide, like
// top-artiste, so there's no episode to inherit a theme/visibility from:
// the theme is resolved from whichever tracks_used row originally recorded
// this exact track, and visibility falls back to the channel's own default.
// Exits 0 (not an error) when nothing matches today — most days won't have
// one, that's expected, not a failure.
const args = process.argv.slice(2);
const [channelConfigPath] = args;
const upload = args.includes("--upload");
const dateArg = args.find((arg) => arg.startsWith("--date="));
const windowDaysArg = args.find((arg) => arg.startsWith("--window-days="));
const referenceDate = dateArg ? new Date(dateArg.slice("--date=".length)) : new Date();
const windowDays = windowDaysArg ? Number(windowDaysArg.slice("--window-days=".length)) : 0;

if (!channelConfigPath || Number.isNaN(referenceDate.getTime()) || !Number.isInteger(windowDays)) {
  console.error(
    "Usage: generate-short-anniversaire <channel-config.json> [--date=YYYY-MM-DD] [--window-days=0] [--upload]\n" +
      'Cuts a vertical "released N years ago today" Short from the channel\'s track history.\n' +
      "Renders locally by default; pass --upload to also publish it to YouTube (format='short').\n" +
      "--window-days lets you plan ahead (report upcoming anniversaries) without rendering yet — combine with a dry run.",
  );
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);

const channel = await loadChannelConfig(channelConfigPath);
const { spotify, itunes, youtube } = createClientsFromEnv();

const matches = await findAnniversaryMatches(db, spotify, channel.id, referenceDate, windowDays);
if (matches.length === 0) {
  console.log("Aucun anniversaire de sortie trouvé pour cette date — rien à générer aujourd'hui.");
  process.exit(0);
}
if (matches.length > 1) {
  console.log(
    `${matches.length} anniversaires trouvés, un seul sera rendu cette fois (${matches[0]!.title}).`,
  );
}
const match = matches[0]!;

const themeRow = db
  .prepare("SELECT theme_id FROM tracks_used WHERE spotify_track_id = ? AND channel_id = ? LIMIT 1")
  .get(match.spotifyTrackId, channel.id) as { theme_id: string } | undefined;
if (!themeRow) {
  throw new Error(`Impossible de retrouver le theme_id d'origine pour ${match.spotifyTrackId}`);
}

console.log(`Ré-hydratation de "${match.title}" (${match.yearsAgo} ans) pour le short...`);
const track = await hydrateAnniversaryTrack(itunes, match);
if (!track) {
  throw new Error(`Aucun extrait iTunes retrouvé pour "${match.title}" — ${match.artist}`);
}

const runId = Date.now();
const outputDir = fileURLToPath(new URL("../../../data/renders/", import.meta.url));
const outputPath = `${outputDir}${channel.id}-anniversaire-${runId}.mp4`;

const metadata = buildAnniversaireSortieMetadata({
  title: match.title,
  artist: match.artist,
  yearsAgo: match.yearsAgo,
});

// Covers must land on disk BEFORE bundling: Remotion's bundler snapshots
// public/ at bundle time, so anything downloaded afterward 404s from the
// bundled server (same fix as pipeline.ts — see its comment).
await resolvePublicCoverUrls([track.albumCoverUrl], PUBLIC_COVERS_DIR);
const serveUrl = await bundleVideoRenderer();
await publishShort({
  db,
  serveUrl,
  themeLabel: `${match.yearsAgo} ans déjà`,
  tracks: [track],
  outputPath,
  channelId: channel.id,
  themeId: themeRow.theme_id,
  visibility: channel.visibility,
  upload,
  youtube,
  metadata,
});
