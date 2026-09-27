import type { ChannelTheme } from "@blindtest/core";

// Kept in sync by hand with SECONDS_PER_TRACK in
// packages/video-renderer/src/constants.ts — video-renderer isn't set up as
// an importable package (Remotion bundles it by file path, see
// render-episode.ts), so this can't just be a shared import.
const SECONDS_PER_TRACK = 12;

export interface YoutubeMetadataTrack {
  readonly title: string;
  readonly artist: string;
}

export interface YoutubeMetadata {
  readonly title: string;
  readonly description: string;
  readonly tags: string[];
}

// Matches the template decided in docs/CAHIER_DES_CHARGES.md section 5.
export function buildYoutubeMetadata(
  theme: ChannelTheme,
  episodeNumber: number,
  tracks: readonly YoutubeMetadataTrack[],
): YoutubeMetadata {
  const themeHashtag = theme.id.replace(/-/g, "");

  const title = `BLIND TEST ${theme.label} 🎧 | Devine ${tracks.length} chansons en ${SECONDS_PER_TRACK} secondes ! (Ép. ${episodeNumber})`;

  // The track list at the end is a lightweight rights/attribution gesture —
  // see docs/CAHIER_DES_CHARGES.md section 7 (Content ID strategy).
  const trackList = tracks
    .map((track, index) => `${index + 1}. ${track.title} — ${track.artist}`)
    .join("\n");

  const description = [
    `🎵 Blind Test spécial ${theme.label} — ${tracks.length} extraits à deviner en ${SECONDS_PER_TRACK} secondes chrono !`,
    "Combien as-tu trouvé ? Dis ton score en commentaire 👇",
    "",
    "🔔 Abonne-toi pour ne rater aucun épisode — un nouveau thème chaque jour !",
    "",
    `#blindtest #quizmusical #${themeHashtag}`,
    "",
    "🎶 Morceaux de l'épisode :",
    trackList,
  ].join("\n");

  const tags = ["blind test", "quiz musical", theme.label, "devine la chanson"];

  return { title, description, tags };
}

// Same template family as buildYoutubeMetadata, tuned for a short teaser cut
// from an already-published episode (see generate-short.ts) rather than the
// full episode itself: the title/description point at the full episode
// instead of listing every track (there are only a handful here, not the
// full 40-60), and #shorts is included since that hashtag still helps
// discovery even though classification itself is purely aspect-ratio/
// duration-based.
export function buildShortMetadata(
  theme: ChannelTheme,
  episodeNumber: number,
  shortTrackCount: number,
  fullEpisodeTrackCount: number,
): YoutubeMetadata {
  const themeHashtag = theme.id.replace(/-/g, "");

  const title = `${shortTrackCount} extraits ${theme.label} en ${SECONDS_PER_TRACK}s chrono 🎧 #Shorts`;

  const description = [
    `Un avant-goût de l'épisode "${theme.label}" (Ép. ${episodeNumber}) — ${fullEpisodeTrackCount} morceaux à deviner en entier sur la chaîne !`,
    "",
    "🔔 Abonne-toi pour ne rater aucun épisode — un nouveau thème chaque jour !",
    "",
    `#shorts #blindtest #quizmusical #${themeHashtag}`,
  ].join("\n");

  const tags = ["blind test", "quiz musical", theme.label, "shorts"];

  return { title, description, tags };
}

// Family A, type 2 (pepite-meconnue.ts): same episode as buildShortMetadata,
// but framed as "songs you probably missed" instead of "guess these songs"
// — the angle is the hook here, not a countdown-style challenge.
export function buildPepiteMeconnueMetadata(
  theme: ChannelTheme,
  tracks: readonly YoutubeMetadataTrack[],
): YoutubeMetadata {
  const themeHashtag = theme.id.replace(/-/g, "");
  const trackList = tracks.map((track) => `${track.title} — ${track.artist}`).join("\n");

  const title = `Tu connais ces pépites ${theme.label} ? 🎧 #Shorts`;

  const description = [
    `Des morceaux ${theme.label} que tu as peut-être ratés — écoute jusqu'au bout !`,
    "",
    "🔔 Abonne-toi pour ne rater aucun épisode — un nouveau thème chaque jour !",
    "",
    `#shorts #blindtest #pepite #${themeHashtag}`,
    "",
    trackList,
  ].join("\n");

  const tags = ["blind test", "pepite meconnue", theme.label, "shorts"];

  return { title, description, tags };
}

// Family A, type 3 (top-artiste.ts): honestly framed as "our selection"
// rather than a literal "Top N" — the Short only shows `tracks.length`
// tracks (2-3, for completion rate, see docs/CLOUD_SESSION_LOG.md), which
// won't always be the artist's true best N, just the best N *of what this
// channel has already featured*.
export function buildTopArtisteMetadata(
  artistName: string,
  tracks: readonly YoutubeMetadataTrack[],
): YoutubeMetadata {
  const artistHashtag = artistName.replace(/[^a-zA-Z0-9]/g, "");
  const trackList = tracks.map((track) => `${track.title} — ${track.artist}`).join("\n");

  const title = `${tracks.length} pépites de ${artistName} 🎧 #Shorts`;

  const description = [
    `Une sélection de titres de ${artistName} déjà passés sur la chaîne !`,
    "",
    "🔔 Abonne-toi pour ne rater aucun épisode — un nouveau thème chaque jour !",
    "",
    `#shorts #blindtest #${artistHashtag}`,
    "",
    trackList,
  ].join("\n");

  const tags = ["blind test", artistName, "shorts"];

  return { title, description, tags };
}

export interface AnniversaryMetadataTrack extends YoutubeMetadataTrack {
  readonly yearsAgo: number;
}

// Family A, type 4 (anniversaire-sortie.ts): a single-track "this came out
// N years ago today" Short — no episode to point back to, so the CTA stays
// generic (channel-level, like buildPepiteMeconnueMetadata's "un nouveau
// thème chaque jour" framing) rather than naming a specific episode.
export function buildAnniversaireSortieMetadata(track: AnniversaryMetadataTrack): YoutubeMetadata {
  const title = `"${track.title}" est sorti il y a ${track.yearsAgo} ans 🎂🎧 #Shorts`;

  const description = [
    `${track.artist} — "${track.title}" fête ses ${track.yearsAgo} ans aujourd'hui !`,
    "",
    "🔔 Abonne-toi pour ne rater aucun épisode — un nouveau thème chaque jour !",
    "",
    "#shorts #blindtest #anniversaire",
  ].join("\n");

  const tags = ["blind test", track.artist, "anniversaire", "shorts"];

  return { title, description, tags };
}
