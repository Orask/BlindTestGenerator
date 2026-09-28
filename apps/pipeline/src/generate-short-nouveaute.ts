import { fileURLToPath } from "node:url";
import { openDatabase } from "@blindtest/db";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { createClientsFromEnv } from "./create-clients.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { titleArtistKey, selectNewReleaseTracks } from "./shorts/nouveaute-genre.js";
import { publishShort } from "./shorts/publish-short.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";
import { buildNouveauteMetadata } from "./youtube-metadata.js";

// Family B, types 5/6: pure traffic generation, one run per genre (see
// shorts/nouveaute-genre.ts) — run this once per desired genre (e.g. "rap
// francais", "house", "variete francaise") to get several independent
// weekly Shorts, one per genre, rather than one file per genre. Never
// tied to a theme/episode: theme/visibility fall back to the channel's
// first theme and default visibility, same reasoning as
// generate-short-top-artiste.ts (nothing episode-specific to inherit from).
const DEFAULT_SHORT_TRACK_COUNT = 2;

const args = process.argv.slice(2);
const [channelConfigPath, genreQuery] = args;
const upload = args.includes("--upload");
const trackCountArg = args.find((arg) => arg.startsWith("--track-count="));
const shortTrackCount = trackCountArg
  ? Number(trackCountArg.slice("--track-count=".length))
  : DEFAULT_SHORT_TRACK_COUNT;
const labelArg = args.find((arg) => arg.startsWith("--label="));
const genreLabel = labelArg ? labelArg.slice("--label=".length) : genreQuery;

if (
  !channelConfigPath ||
  !genreQuery ||
  !Number.isInteger(shortTrackCount) ||
  shortTrackCount < 1
) {
  console.error(
    'Usage: generate-short-nouveaute <channel-config.json> "<genre-search-query>" [--label="Rap FR"] [--track-count=2] [--upload]\n' +
      "Cuts a vertical Short from genuinely new releases for a genre — never reuses tracks_used or curatedTracks.\n" +
      "Renders locally by default; pass --upload to also publish it to YouTube (format='short').",
  );
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);

const channel = await loadChannelConfig(channelConfigPath);
const theme = channel.themes[0];
if (!theme) {
  throw new Error(`Channel config ${channelConfigPath} has no themes`);
}

const curatedTrackKeys = new Set(
  channel.themes.flatMap(
    (t) => t.curatedTracks?.map((pair) => titleArtistKey(pair.title, pair.artist)) ?? [],
  ),
);

const { spotify, itunes, youtube } = createClientsFromEnv();

console.log(`Recherche de ${shortTrackCount} nouveauté(s) pour "${genreQuery}"...`);
const tracks = await selectNewReleaseTracks(
  db,
  spotify,
  itunes,
  channel.id,
  genreQuery,
  shortTrackCount,
  new Date(),
  curatedTrackKeys,
);
if (tracks.length === 0) {
  console.log(`Aucune nouveauté exploitable trouvée pour "${genreQuery}" — rien à générer.`);
  process.exit(0);
}

const runId = Date.now();
const outputDir = fileURLToPath(new URL("../../../data/renders/", import.meta.url));
const outputPath = `${outputDir}${channel.id}-nouveaute-${runId}.mp4`;

const metadata = buildNouveauteMetadata(genreLabel!, tracks);

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
  themeLabel: `Nouveautés ${genreLabel}`,
  tracks,
  outputPath,
  channelId: channel.id,
  themeId: theme.id,
  visibility: channel.visibility,
  upload,
  youtube,
  metadata,
});
