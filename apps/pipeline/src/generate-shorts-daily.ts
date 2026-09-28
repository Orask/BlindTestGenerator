import { fileURLToPath } from "node:url";
import type { ChannelConfig, ChannelTheme } from "@blindtest/core";
import { resolveThemeForDay, weekdayFromDate } from "@blindtest/core";
import { getLatestUploadedVideoForTheme, openDatabase } from "@blindtest/db";
import type { DeezerClient } from "@blindtest/deezer";
import type { ItunesClient } from "@blindtest/itunes";
import type { SpotifyClient } from "@blindtest/spotify";
import type { YoutubeClient } from "@blindtest/youtube";
import type Database from "better-sqlite3";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { createClientsFromEnv } from "./create-clients.js";
import { resolvePublicCoverUrls } from "./download-cover-images.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { findAnniversaryMatches, hydrateAnniversaryTrack } from "./shorts/anniversaire-sortie.js";
import { selectDevineLaChansonTracks } from "./shorts/devine-la-chanson.js";
import { titleArtistKey, selectNewReleaseTracks } from "./shorts/nouveaute-genre.js";
import { selectPepiteMeconnueTracks } from "./shorts/pepite-meconnue.js";
import { publishShort } from "./shorts/publish-short.js";
import { selectTopArtisteTracks } from "./shorts/top-artiste.js";
import {
  artistForDate,
  genreForDate,
  shortTypesForDay,
  type ShortTypeId,
} from "./shorts/weekly-rotation.js";
import { PUBLIC_COVERS_DIR } from "./video-renderer-paths.js";
import {
  buildAnniversaireSortieMetadata,
  buildNouveauteMetadata,
  buildPepiteMeconnueMetadata,
  buildShortMetadata,
  buildTopArtisteMetadata,
} from "./youtube-metadata.js";

// Daily Shorts orchestrator (see docs/CLOUD_SESSION_LOG.md, "Automatisation
// quotidienne") — runs all of today's rotation slots (shorts/weekly-
// rotation.ts) in one invocation, one per Short type, each independently
// resilient: a type with nothing to say today (no episode yet, no
// anniversary, no fresh release found) logs and moves on instead of
// failing the whole run, same philosophy as runWeeklyBatch in pipeline.ts.
//
// Safe-by-default, same convention as every other generate-short*.ts
// script in this project: renders locally only unless --upload is passed.
// This IS the dry-run mode the automation was asked to have — no separate
// flag needed, it's the same default every other Short/episode CLI script
// already uses. The GitHub Actions workflow only passes --upload once
// dry-run renders have been checked (see .github/workflows/daily-shorts.yml).
const SHORT_TRACK_COUNT = 2;

function outputPathFor(outputDir: string, channelId: string, suffix: string): string {
  return `${outputDir}${channelId}-${suffix}-${Date.now()}.mp4`;
}

interface Ctx {
  readonly db: Database.Database;
  readonly channel: ChannelConfig;
  readonly spotify: SpotifyClient;
  readonly deezer: DeezerClient;
  readonly itunes: ItunesClient;
  readonly youtube: YoutubeClient;
  readonly outputDir: string;
  readonly upload: boolean;
  readonly now: Date;
}

// Each attempt resolves its OWN covers then bundles right before rendering,
// rather than sharing one serveUrl bundled up front for the whole run: which
// tracks (and therefore which cover URLs) a type needs isn't known until
// that type's selector has run, and Remotion's bundler snapshots public/ at
// bundle time — bundling before covers exist 404s every render (same fix as
// pipeline.ts/generate-short.ts — see their comments). Bundling per
// successful attempt (at most ~2-3/day, see weekly-rotation.ts) costs a bit
// more than a single shared bundle but is the only way to get this right.
async function resolveCoversAndBundle(coverUrls: readonly string[]): Promise<string> {
  await resolvePublicCoverUrls(coverUrls, PUBLIC_COVERS_DIR);
  return bundleVideoRenderer();
}

function todaysTheme(ctx: Ctx): ChannelTheme {
  return resolveThemeForDay(ctx.channel.themes, weekdayFromDate(ctx.now));
}

async function attemptDevineLaChanson(ctx: Ctx): Promise<boolean> {
  const theme = todaysTheme(ctx);
  const source = getLatestUploadedVideoForTheme(ctx.db, theme.id);
  if (!source) {
    console.log(`[devine-la-chanson] Pas encore d'épisode publié pour "${theme.label}", ignoré.`);
    return false;
  }

  const tracks = await selectDevineLaChansonTracks(
    ctx.db,
    ctx.spotify,
    ctx.deezer,
    ctx.itunes,
    source.id,
    SHORT_TRACK_COUNT,
  );
  if (tracks.length === 0) {
    console.log(
      `[devine-la-chanson] Aucun morceau exploitable pour l'épisode ${source.id}, ignoré.`,
    );
    return false;
  }

  const fullEpisodeTrackCountRow = ctx.db
    .prepare("SELECT COUNT(*) AS count FROM tracks_used WHERE video_id = ?")
    .get(source.id) as { count: number };
  const episodeNumberRow = ctx.db
    .prepare(
      "SELECT COUNT(*) AS count FROM videos WHERE theme_id = ? AND created_at <= (SELECT created_at FROM videos WHERE id = ?)",
    )
    .get(theme.id, source.id) as { count: number };
  const metadata = buildShortMetadata(
    theme,
    episodeNumberRow.count,
    tracks.length,
    fullEpisodeTrackCountRow.count,
  );

  const serveUrl = await resolveCoversAndBundle(tracks.map((track) => track.albumCoverUrl));
  await publishShort({
    db: ctx.db,
    serveUrl,
    themeLabel: theme.label,
    tracks,
    fullEpisodeTrackCount: fullEpisodeTrackCountRow.count,
    outputPath: outputPathFor(ctx.outputDir, ctx.channel.id, `${theme.id}-devine-la-chanson`),
    channelId: source.channelId,
    themeId: theme.id,
    visibility: source.visibility as "private" | "unlisted" | "public",
    upload: ctx.upload,
    youtube: ctx.youtube,
    metadata,
  });
  return true;
}

async function attemptPepiteMeconnue(ctx: Ctx): Promise<boolean> {
  const theme = todaysTheme(ctx);
  const source = getLatestUploadedVideoForTheme(ctx.db, theme.id);
  if (!source) {
    console.log(`[pepite-meconnue] Pas encore d'épisode publié pour "${theme.label}", ignoré.`);
    return false;
  }

  const tracks = await selectPepiteMeconnueTracks(
    ctx.db,
    ctx.spotify,
    ctx.deezer,
    ctx.itunes,
    source.id,
    SHORT_TRACK_COUNT,
  );
  if (tracks.length === 0) {
    console.log(`[pepite-meconnue] Aucun morceau exploitable pour l'épisode ${source.id}, ignoré.`);
    return false;
  }

  const metadata = buildPepiteMeconnueMetadata(theme, tracks);
  const serveUrl = await resolveCoversAndBundle(tracks.map((track) => track.albumCoverUrl));
  await publishShort({
    db: ctx.db,
    serveUrl,
    themeLabel: theme.label,
    tracks,
    outputPath: outputPathFor(ctx.outputDir, ctx.channel.id, `${theme.id}-pepite-meconnue`),
    channelId: source.channelId,
    themeId: theme.id,
    visibility: source.visibility as "private" | "unlisted" | "public",
    upload: ctx.upload,
    youtube: ctx.youtube,
    metadata,
  });
  return true;
}

async function attemptTopArtiste(ctx: Ctx): Promise<boolean> {
  const seedArtistPool = [...new Set(ctx.channel.themes.flatMap((t) => t.seedArtists))].sort();
  const artistName = artistForDate(seedArtistPool, ctx.now);
  if (!artistName) {
    console.log("[top-artiste] Aucun seedArtists configuré, ignoré.");
    return false;
  }
  const theme =
    ctx.channel.themes.find((t) => t.seedArtists.includes(artistName)) ?? ctx.channel.themes[0]!;

  const tracks = await selectTopArtisteTracks(
    ctx.db,
    ctx.spotify,
    ctx.deezer,
    ctx.itunes,
    ctx.channel.id,
    artistName,
    SHORT_TRACK_COUNT,
  );
  if (tracks.length === 0) {
    console.log(`[top-artiste] Aucun morceau de "${artistName}" dans l'historique, ignoré.`);
    return false;
  }

  const metadata = buildTopArtisteMetadata(artistName, tracks);
  const serveUrl = await resolveCoversAndBundle(tracks.map((track) => track.albumCoverUrl));
  await publishShort({
    db: ctx.db,
    serveUrl,
    themeLabel: artistName,
    tracks,
    outputPath: outputPathFor(ctx.outputDir, ctx.channel.id, "top-artiste"),
    channelId: ctx.channel.id,
    themeId: theme.id,
    visibility: ctx.channel.visibility,
    upload: ctx.upload,
    youtube: ctx.youtube,
    metadata,
  });
  return true;
}

async function attemptAnniversaireSortie(ctx: Ctx): Promise<boolean> {
  const matches = await findAnniversaryMatches(ctx.db, ctx.spotify, ctx.channel.id, ctx.now);
  if (matches.length === 0) {
    console.log("[anniversaire-sortie] Aucun anniversaire de sortie aujourd'hui, ignoré.");
    return false;
  }
  const match = matches[0]!;

  const themeRow = ctx.db
    .prepare(
      "SELECT theme_id FROM tracks_used WHERE spotify_track_id = ? AND channel_id = ? LIMIT 1",
    )
    .get(match.spotifyTrackId, ctx.channel.id) as { theme_id: string } | undefined;
  if (!themeRow) {
    console.log(`[anniversaire-sortie] theme_id introuvable pour ${match.spotifyTrackId}, ignoré.`);
    return false;
  }

  const track = await hydrateAnniversaryTrack(ctx.itunes, match);
  if (!track) {
    console.log(`[anniversaire-sortie] Aucun extrait iTunes pour "${match.title}", ignoré.`);
    return false;
  }

  const metadata = buildAnniversaireSortieMetadata({
    title: match.title,
    artist: match.artist,
    yearsAgo: match.yearsAgo,
  });
  const serveUrl = await resolveCoversAndBundle([track.albumCoverUrl]);
  await publishShort({
    db: ctx.db,
    serveUrl,
    themeLabel: `${match.yearsAgo} ans déjà`,
    tracks: [track],
    outputPath: outputPathFor(ctx.outputDir, ctx.channel.id, "anniversaire-sortie"),
    channelId: ctx.channel.id,
    themeId: themeRow.theme_id,
    visibility: ctx.channel.visibility,
    upload: ctx.upload,
    youtube: ctx.youtube,
    metadata,
  });
  return true;
}

async function attemptNouveauteGenre(ctx: Ctx): Promise<boolean> {
  const genreQuery = genreForDate(ctx.now);
  const theme = ctx.channel.themes[0]!;
  const curatedTrackKeys = new Set(
    ctx.channel.themes.flatMap(
      (t) => t.curatedTracks?.map((pair) => titleArtistKey(pair.title, pair.artist)) ?? [],
    ),
  );

  const tracks = await selectNewReleaseTracks(
    ctx.db,
    ctx.spotify,
    ctx.itunes,
    ctx.channel.id,
    genreQuery,
    SHORT_TRACK_COUNT,
    ctx.now,
    curatedTrackKeys,
  );
  if (tracks.length === 0) {
    console.log(`[nouveaute-genre] Aucune nouveauté exploitable pour "${genreQuery}", ignoré.`);
    return false;
  }

  const metadata = buildNouveauteMetadata(genreQuery, tracks);
  const serveUrl = await resolveCoversAndBundle(tracks.map((track) => track.albumCoverUrl));
  await publishShort({
    db: ctx.db,
    serveUrl,
    themeLabel: `Nouveautés ${genreQuery}`,
    tracks,
    outputPath: outputPathFor(ctx.outputDir, ctx.channel.id, "nouveaute-genre"),
    channelId: ctx.channel.id,
    themeId: theme.id,
    visibility: ctx.channel.visibility,
    upload: ctx.upload,
    youtube: ctx.youtube,
    metadata,
  });
  return true;
}

const ATTEMPTS: Record<ShortTypeId, (ctx: Ctx) => Promise<boolean>> = {
  "devine-la-chanson": attemptDevineLaChanson,
  "pepite-meconnue": attemptPepiteMeconnue,
  "top-artiste": attemptTopArtiste,
  "anniversaire-sortie": attemptAnniversaireSortie,
  "nouveaute-genre": attemptNouveauteGenre,
};

const args = process.argv.slice(2);
const [channelConfigPath] = args;
const upload = args.includes("--upload");

if (!channelConfigPath) {
  console.error(
    "Usage: generate-shorts-daily <channel-config.json> [--upload]\n" +
      "Runs today's rotation of Family A/B Shorts (shorts/weekly-rotation.ts).\n" +
      "Renders locally by default (dry run) — pass --upload to actually publish to YouTube.",
  );
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);
const channel = await loadChannelConfig(channelConfigPath);
const { spotify, deezer, itunes, youtube } = createClientsFromEnv();
const outputDir = fileURLToPath(new URL("../../../data/renders/", import.meta.url));

const now = new Date();
const ctx: Ctx = { db, channel, spotify, deezer, itunes, youtube, outputDir, upload, now };
const todaysTypes = shortTypesForDay(weekdayFromDate(now));

console.log(
  `Rotation du jour (${weekdayFromDate(now)}) : ${todaysTypes.join(", ")}${upload ? "" : " (dry run, ajoute --upload pour publier)"}`,
);

const failures: { type: ShortTypeId; error: unknown }[] = [];
let published = 0;
for (const type of todaysTypes) {
  try {
    const didPublish = await ATTEMPTS[type](ctx);
    if (didPublish) {
      published++;
    }
  } catch (error) {
    console.error(`[${type}] Échec :`, error);
    failures.push({ type, error });
  }
}

console.log(`${published}/${todaysTypes.length} Short(s) généré(s) aujourd'hui.`);

if (failures.length > 0) {
  throw new Error(
    `${failures.length}/${todaysTypes.length} type(s) de Short ont échoué : ${failures.map((f) => f.type).join(", ")}`,
  );
}
