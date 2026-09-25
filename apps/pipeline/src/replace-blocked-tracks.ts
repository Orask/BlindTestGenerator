import { fileURLToPath } from "node:url";
import {
  blockTrack,
  getBlockedTrackIds,
  getPlaylistId,
  getUsedTrackIds,
  getUsedTrackIdsSince,
  markVideoUploaded,
  openDatabase,
  recordTrackUsage,
  setPlaylistId,
} from "@blindtest/db";
import { bundleVideoRenderer } from "./bundle-video-renderer.js";
import { REUSE_COOLDOWN_DAYS } from "./build-episode-tracks.js";
import { collectCandidateTracks } from "./collect-candidates.js";
import { createClientsFromEnv } from "./create-clients.js";
import { spreadOutArtists } from "./diversify-artists.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { renderEpisode } from "./render-episode.js";
import { renderThumbnail } from "./render-thumbnail.js";
import { buildYoutubeMetadata } from "./youtube-metadata.js";

// One-off: a track that got a YouTube Content ID claim serious enough to
// block a published video (confirmed live: two tracks made a whole episode
// unwatchable worldwide) is permanently blocklisted (see
// blocked-tracks-repository.ts, so no future episode ever picks it again),
// then the episode is rebuilt with fresh replacements and re-uploaded.
// YouTube doesn't expose Content ID claim details via the public Data API
// (that needs CMS/partner access), so the blocked (title, artist) pairs have
// to come from a human reading YouTube Studio's Copyright tab.
const ITUNES_LOOKUP_DELAY_MS = 3500;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Mirrors build-episode-tracks.ts's own (unexported) constant — replacements
// must respect the same per-artist cap as the original selection did.
const MAX_TRACKS_PER_ARTIST = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const COMBINING_DIACRITICS = /[̀-ͯ]/g;
function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

const args = process.argv.slice(2);
const [channelConfigPath, videoRowId] = args;
const deleteOld = args.includes("--delete-old");
const blockSpecs: { title: string; artist: string }[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--block") {
    const spec = args[i + 1];
    const separatorIndex = spec?.indexOf("||") ?? -1;
    if (!spec || separatorIndex === -1) {
      console.error(`--block attend le format "Titre||Artiste", reçu : ${spec}`);
      process.exit(1);
    }
    blockSpecs.push({
      title: spec.slice(0, separatorIndex),
      artist: spec.slice(separatorIndex + 2),
    });
  }
}

if (!channelConfigPath || !videoRowId || blockSpecs.length === 0) {
  console.error(
    'Usage: replace-blocked-tracks <channel-config.json> <video-row-id> --block "Titre||Artiste" [--block ...] [--delete-old]\n' +
      'Le(s) titre/artiste viennent de l\'onglet Copyright de YouTube Studio (réclamations "bloquée dans le monde entier").\n' +
      "--delete-old supprime l'ancienne vidéo bloquée sur YouTube une fois la nouvelle publiée avec succès.",
  );
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);

const videoRow = db.prepare("SELECT * FROM videos WHERE id = ?").get(videoRowId) as
  | {
      theme_id: string;
      visibility: "private" | "unlisted" | "public";
      youtube_video_id: string | null;
    }
  | undefined;
if (!videoRow) {
  throw new Error(`No video row found with id ${videoRowId}`);
}

const trackRows = db
  .prepare(
    "SELECT spotify_track_id, title, artist FROM tracks_used WHERE video_id = ? ORDER BY rowid",
  )
  .all(videoRowId) as { spotify_track_id: string; title: string; artist: string }[];
if (trackRows.length === 0) {
  throw new Error(`No tracks_used rows found for video ${videoRowId}`);
}

const blockedRows = blockSpecs.map((spec) => {
  const matches = trackRows.filter(
    (row) =>
      normalize(row.title) === normalize(spec.title) &&
      normalize(row.artist).includes(normalize(spec.artist)),
  );
  if (matches.length !== 1) {
    throw new Error(
      `${matches.length} correspondance(s) pour "${spec.title}" — ${spec.artist} (attendu : exactement 1)`,
    );
  }
  return matches[0]!;
});

const blockedAt = new Date();
for (const row of blockedRows) {
  blockTrack(db, {
    spotifyTrackId: row.spotify_track_id,
    title: row.title,
    artist: row.artist,
    reason: "YouTube Content ID : vidéo bloquée dans le monde entier",
    blockedAt,
  });
  console.log(`Bloqué définitivement : "${row.title}" — ${row.artist}`);
}

const blockedIds = new Set(blockedRows.map((row) => row.spotify_track_id));
const remainingRows = trackRows.filter((row) => !blockedIds.has(row.spotify_track_id));

const channel = await loadChannelConfig(channelConfigPath);
const theme = channel.themes.find((candidate) => candidate.id === videoRow.theme_id);
if (!theme) {
  throw new Error(`Theme ${videoRow.theme_id} not found in channel config`);
}

const { spotify, itunes, youtube } = createClientsFromEnv();

console.log(`Ré-hydratation de ${remainingRows.length} morceaux conservés...`);
const keptTracks = [];
for (const row of remainingRows) {
  const metadata = await spotify.getTrackById(row.spotify_track_id);
  const preview = await itunes.findPreviewByTitleAndArtist(row.title, row.artist);
  await sleep(ITUNES_LOOKUP_DELAY_MS);
  if (!preview) {
    throw new Error(`Aucun extrait iTunes retrouvé pour "${row.title}" — ${row.artist}`);
  }
  keptTracks.push({
    id: row.spotify_track_id,
    title: row.title,
    artist: row.artist,
    artistNames: metadata.artistNames,
    albumCoverUrl: metadata.albumCoverUrl,
    audioUrl: preview.previewUrl,
  });
}

const replacementsNeeded = blockedRows.length;
console.log(`Recherche de ${replacementsNeeded} morceau(x) de remplacement...`);

const cooldownCutoff = new Date(Date.now() - REUSE_COOLDOWN_DAYS * MS_PER_DAY);
const excludeIds = new Set([
  ...getUsedTrackIdsSince(db, channel.id, cooldownCutoff),
  ...getBlockedTrackIds(db),
  ...keptTracks.map((track) => track.id),
]);
const allTimeUsedTrackIds = getUsedTrackIds(db, channel.id);

const artistCounts = new Map<string, number>();
for (const track of keptTracks) {
  for (const name of track.artistNames) {
    artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1);
  }
}

const candidates = await collectCandidateTracks(spotify, theme.seedArtists, 20);
const replacements = [];
for (const candidate of candidates) {
  if (replacements.length === replacementsNeeded) {
    break;
  }
  if (excludeIds.has(candidate.id) || allTimeUsedTrackIds.has(candidate.id)) {
    continue;
  }
  const wouldExceedCap = candidate.artistNames.some(
    (name) => (artistCounts.get(name) ?? 0) >= MAX_TRACKS_PER_ARTIST,
  );
  if (wouldExceedCap) {
    continue;
  }
  const preview = await itunes.findPreviewByTitleAndArtist(candidate.title, candidate.artist);
  await sleep(ITUNES_LOOKUP_DELAY_MS);
  if (!preview) {
    continue;
  }
  for (const name of candidate.artistNames) {
    artistCounts.set(name, (artistCounts.get(name) ?? 0) + 1);
  }
  replacements.push({ ...candidate, audioUrl: preview.previewUrl });
}

if (replacements.length < replacementsNeeded) {
  throw new Error(
    `Seulement ${replacements.length}/${replacementsNeeded} remplacement(s) trouvé(s) — vivier insuffisant.`,
  );
}
console.log(
  `Remplacement(s) trouvé(s) : ${replacements.map((t) => `"${t.title}" (${t.artist})`).join(", ")}`,
);

const finalTracks = spreadOutArtists([...keptTracks, ...replacements]);

const runId = Date.now();
const outputDir = fileURLToPath(new URL("../../../data/renders/", import.meta.url));
const outputPath = `${outputDir}${channel.id}-${theme.id}-${runId}-fixed.mp4`;
const thumbnailPath = `${outputDir}${channel.id}-${theme.id}-${runId}-fixed-thumbnail.jpg`;

const serveUrl = await bundleVideoRenderer();
await renderEpisode({ serveUrl, themeLabel: theme.label, tracks: finalTracks, outputPath });
console.log(`Vidéo rendue : ${outputPath}`);
await renderThumbnail({
  serveUrl,
  themeLabel: theme.label,
  tracks: finalTracks,
  outputPath: thumbnailPath,
});
console.log(`Miniature rendue : ${thumbnailPath}`);

const episodeNumberRow = db
  .prepare(
    "SELECT COUNT(*) AS count FROM videos WHERE theme_id = ? AND created_at <= (SELECT created_at FROM videos WHERE id = ?)",
  )
  .get(theme.id, videoRowId) as { count: number };

const { title, description, tags } = buildYoutubeMetadata(
  theme,
  episodeNumberRow.count,
  finalTracks,
);

const { videoId: newYoutubeVideoId } = await youtube.uploadVideo({
  filePath: outputPath,
  title,
  description,
  tags,
  visibility: videoRow.visibility,
});
console.log(`Publiée sur YouTube : https://youtu.be/${newYoutubeVideoId}`);

// Checkpoint immediately, same reasoning as pipeline.ts: the video is live
// from this point on, thumbnail/playlist are extras that must not be able
// to undo that.
markVideoUploaded(db, videoRowId, newYoutubeVideoId);
db.prepare("DELETE FROM tracks_used WHERE video_id = ?").run(videoRowId);
for (const track of finalTracks) {
  recordTrackUsage(db, {
    channelId: channel.id,
    themeId: theme.id,
    spotifyTrackId: track.id,
    title: track.title,
    artist: track.artist,
    videoId: videoRowId,
    usedAt: new Date(),
  });
}

try {
  await youtube.setThumbnail(newYoutubeVideoId, thumbnailPath);
} catch (error) {
  console.warn(`Échec de l'envoi de la miniature : ${(error as Error).message}`);
}

try {
  let playlistId = getPlaylistId(db, theme.id);
  if (!playlistId) {
    playlistId = (await youtube.ensurePlaylist(theme.label)).playlistId;
    setPlaylistId(db, theme.id, playlistId);
  }
  await youtube.addVideoToPlaylist(newYoutubeVideoId, playlistId);
} catch (error) {
  console.warn(`Échec de l'ajout à la playlist : ${(error as Error).message}`);
}

if (videoRow.youtube_video_id) {
  if (deleteOld) {
    await youtube.deleteVideo(videoRow.youtube_video_id);
    console.log(`Ancienne vidéo bloquée supprimée : ${videoRow.youtube_video_id}`);
  } else {
    console.log(
      `Ancienne vidéo bloquée à supprimer manuellement si besoin : ${videoRow.youtube_video_id}`,
    );
  }
}
