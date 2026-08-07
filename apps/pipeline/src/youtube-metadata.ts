import type { ChannelTheme } from "@blindtest/core";

export interface YoutubeMetadata {
  readonly title: string;
  readonly description: string;
  readonly tags: string[];
}

// Matches the template decided in docs/CAHIER_DES_CHARGES.md section 5.
export function buildYoutubeMetadata(theme: ChannelTheme, episodeNumber: number): YoutubeMetadata {
  const themeHashtag = theme.id.replace(/-/g, "");

  const title = `BLIND TEST ${theme.label} 🎧 | Devine 40 chansons en 10 secondes ! (Ép. ${episodeNumber})`;

  const description = [
    `🎵 Blind Test spécial ${theme.label} — 40 extraits à deviner en 10 secondes chrono !`,
    "Combien as-tu trouvé ? Dis ton score en commentaire 👇",
    "",
    "🔔 Abonne-toi pour ne rater aucun épisode — un nouveau thème chaque jour !",
    "",
    `#blindtest #quizmusical #${themeHashtag}`,
  ].join("\n");

  const tags = ["blind test", "quiz musical", theme.label, "devine la chanson"];

  return { title, description, tags };
}
