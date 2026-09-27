import { fileURLToPath } from "node:url";
import type { ChannelConfig, ChannelTheme } from "@blindtest/core";
import { openDatabase } from "@blindtest/db";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { createClientsFromEnv } from "./create-clients.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { publishShort } from "./shorts/publish-short.js";
import { selectTopArtisteTracks } from "./shorts/top-artiste.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";
import { buildTopArtisteMetadata } from "./youtube-metadata.js";

// Family A, type 3: the channel's best tracks *of one specific artist*,
// built entirely from what the channel has already featured — see
// shorts/top-artiste.ts. Unlike types 1/2, this isn't tied to a single
// episode, so there's no video row to inherit a theme/visibility from: the
// theme is resolved by finding which theme lists this artist in
// seedArtists (the artist has to belong to the channel's roster somehow),
// and visibility falls back to the channel's own default.
const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

function findThemeBySeedArtistOrThrow(channel: ChannelConfig, artistName: string): ChannelTheme {
  const normalizedArtist = normalize(artistName);
  const theme = channel.themes.find((candidate) =>
    candidate.seedArtists.some((seed) => normalize(seed) === normalizedArtist),
  );
  if (!theme) {
    throw new Error(
      `Aucun thème du channel config ne liste "${artistName}" dans seedArtists — vérifie l'orthographe exacte.`,
    );
  }
  return theme;
}

const DEFAULT_SHORT_TRACK_COUNT = 2;

const args = process.argv.slice(2);
const [channelConfigPath, artistName] = args;
const upload = args.includes("--upload");
const trackCountArg = args.find((arg) => arg.startsWith("--track-count="));
const shortTrackCount = trackCountArg
  ? Number(trackCountArg.slice("--track-count=".length))
  : DEFAULT_SHORT_TRACK_COUNT;

if (
  !channelConfigPath ||
  !artistName ||
  !Number.isInteger(shortTrackCount) ||
  shortTrackCount < 1
) {
  console.error(
    'Usage: generate-short-top-artiste <channel-config.json> "<artist-name>" [--track-count=2] [--upload]\n' +
      "Cuts a vertical Short from the channel's best-known tracks of one seedArtists artist.\n" +
      "Renders locally by default; pass --upload to also publish it to YouTube (format='short').",
  );
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);

const channel = await loadChannelConfig(channelConfigPath);
const theme = findThemeBySeedArtistOrThrow(channel, artistName);

const { spotify, deezer, itunes, youtube } = createClientsFromEnv();

console.log(`Recherche des ${shortTrackCount} morceau(x) les plus populaires de ${artistName}...`);
const tracks = await selectTopArtisteTracks(
  db,
  spotify,
  deezer,
  itunes,
  channel.id,
  artistName,
  shortTrackCount,
);
if (tracks.length === 0) {
  throw new Error(`Aucun morceau de "${artistName}" trouvé dans l'historique de la chaîne`);
}

const runId = Date.now();
const outputDir = fileURLToPath(new URL("../../../data/renders/", import.meta.url));
const outputPath = `${outputDir}${channel.id}-top-artiste-${runId}.mp4`;

const metadata = buildTopArtisteMetadata(artistName, tracks);

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
  themeLabel: artistName,
  tracks,
  outputPath,
  channelId: channel.id,
  themeId: theme.id,
  visibility: channel.visibility,
  upload,
  youtube,
  metadata,
});
