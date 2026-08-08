import { fileURLToPath } from "node:url";
import { getPlaylistId, markVideoUploaded, openDatabase, setPlaylistId } from "@blindtest/db";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { createClientsFromEnv } from "./create-clients.js";
import { spreadOutArtists } from "./diversify-artists.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { renderEpisode } from "./render-episode.js";
import { renderThumbnail } from "./render-thumbnail.js";
import { buildYoutubeMetadata } from "./youtube-metadata.js";

// One-off: re-renders and re-uploads an already-published episode using the
// EXACT SAME 60 tracks, only reordered with the fixed artist-spacing logic
// (see docs/CAHIER_DES_CHARGES.md section 3septies) — for fixing a
// same-artist-repeats-adjacently episode without burning fresh candidates
// from an already-thin seed-artist pool. Only re-fetches per-track cover
// art (by id, no search) and re-resolves iTunes previews; no new Spotify
// search or track selection happens.
const ITUNES_LOOKUP_DELAY_MS = 3500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const [channelConfigPath, videoId, existingRenderPath, existingThumbnailPath] =
  process.argv.slice(2);
if (!channelConfigPath || !videoId) {
  console.error(
    "Usage: recut-episode <channel-config.json> <video-row-id> [existing-render.mp4] [existing-thumbnail.jpg]\n" +
      "The last two are optional — pass them to retry just the upload after a previous run rendered successfully but failed to upload (e.g. hit YouTube's daily upload cap), skipping the render entirely.",
  );
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);

const videoRow = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoId) as
  | {
      theme_id: string;
      visibility: "private" | "unlisted" | "public";
      youtube_video_id: string | null;
    }
  | undefined;
if (!videoRow) {
  throw new Error(`No video row found with id ${videoId}`);
}

const trackRows = db
  .prepare(
    "SELECT spotify_track_id, title, artist FROM tracks_used WHERE video_id = ? ORDER BY rowid",
  )
  .all(videoId) as { spotify_track_id: string; title: string; artist: string }[];
if (trackRows.length === 0) {
  throw new Error(`No tracks_used rows found for video ${videoId}`);
}

const channel = await loadChannelConfig(channelConfigPath);
const theme = channel.themes.find((candidate) => candidate.id === videoRow.theme_id);
if (!theme) {
  throw new Error(`Theme ${videoRow.theme_id} not found in channel config`);
}

const { spotify, itunes, youtube } = createClientsFromEnv();

// Only what the YouTube description's numbered track list needs — populated
// either way, whether or not a fresh render happens.
let metadataTracks: { title: string; artist: string; artistNames: readonly string[] }[];
let outputPath: string;
let thumbnailPath: string;

if (existingRenderPath && existingThumbnailPath) {
  // Resuming after a previous run rendered fine but failed to upload — the
  // corrected order only depends on each track's artistNames, so it can be
  // recomputed from a handful of fast Spotify lookups, without redoing the
  // iTunes-throttled resolution or the render itself.
  console.log("Réutilisation du rendu existant, recalcul de l'ordre pour la description...");
  const withArtistNames = [];
  for (const row of trackRows) {
    const metadata = await spotify.getTrackById(row.spotify_track_id);
    withArtistNames.push({
      title: row.title,
      artist: row.artist,
      artistNames: metadata.artistNames,
    });
  }
  metadataTracks = spreadOutArtists(withArtistNames);
  outputPath = existingRenderPath;
  thumbnailPath = existingThumbnailPath;
} else {
  console.log(`Ré-hydratation de ${trackRows.length} morceaux (pochette + extrait audio)...`);
  const tracks = [];
  for (const row of trackRows) {
    const metadata = await spotify.getTrackById(row.spotify_track_id);
    const preview = await itunes.findPreviewByTitleAndArtist(row.title, row.artist);
    await sleep(ITUNES_LOOKUP_DELAY_MS);
    if (!preview) {
      throw new Error(`Aucun extrait iTunes retrouvé pour "${row.title}" — ${row.artist}`);
    }
    tracks.push({
      id: row.spotify_track_id,
      title: row.title,
      artist: row.artist,
      artistNames: metadata.artistNames,
      albumCoverUrl: metadata.albumCoverUrl,
      audioUrl: preview.previewUrl,
    });
  }

  const correctedTracks = spreadOutArtists(tracks);
  console.log("Ordre corrigé calculé (plus aucun artiste partagé entre morceaux adjacents).");
  metadataTracks = correctedTracks;

  const runId = Date.now();
  const outputDir = fileURLToPath(new URL("../../../data/renders/", import.meta.url));
  outputPath = `${outputDir}${channel.id}-${theme.id}-${runId}-recut.mp4`;
  thumbnailPath = `${outputDir}${channel.id}-${theme.id}-${runId}-recut-thumbnail.jpg`;

  const serveUrl = await bundleVideoRenderer();
  await renderEpisode({ serveUrl, themeLabel: theme.label, tracks: correctedTracks, outputPath });
  console.log(`Vidéo rendue : ${outputPath}`);
  await renderThumbnail({
    serveUrl,
    themeLabel: theme.label,
    tracks: correctedTracks,
    outputPath: thumbnailPath,
  });
  console.log(`Miniature rendue : ${thumbnailPath}`);
}

const episodeNumberRow = db
  .prepare(
    "SELECT COUNT(*) AS count FROM videos WHERE theme_id = ? AND created_at <= (SELECT created_at FROM videos WHERE id = ?)",
  )
  .get(videoRow.theme_id, videoId) as { count: number };

const { title, description, tags } = buildYoutubeMetadata(
  theme,
  episodeNumberRow.count,
  metadataTracks,
);

const { videoId: youtubeVideoId } = await youtube.uploadVideo({
  filePath: outputPath,
  title,
  description,
  tags,
  visibility: videoRow.visibility,
});

await youtube.setThumbnail(youtubeVideoId, thumbnailPath);

let playlistId = getPlaylistId(db, theme.id);
if (!playlistId) {
  playlistId = (await youtube.ensurePlaylist(theme.label)).playlistId;
  setPlaylistId(db, theme.id, playlistId);
}
await youtube.addVideoToPlaylist(youtubeVideoId, playlistId);

markVideoUploaded(db, videoId, youtubeVideoId);

console.log(`Version corrigée republiée : https://youtu.be/${youtubeVideoId}`);
if (videoRow.youtube_video_id) {
  console.log(`Ancienne vidéo à nettoyer manuellement si besoin : ${videoRow.youtube_video_id}`);
}
