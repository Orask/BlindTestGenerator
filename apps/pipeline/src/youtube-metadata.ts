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
