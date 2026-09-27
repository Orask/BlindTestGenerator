import { zColor } from "@remotion/zod-types";
import { z } from "zod";

export const thumbnailSchema = z.object({
  themeLabel: z.string(),
  trackCount: z.number().int().positive(),
  coverImageUrls: z.array(z.string()).min(1),
  // Real artist photos for the episode's most prominent artists (not album
  // covers) — the actual hero visual. Can be empty (falls back to the cover
  // grid) when no artist photo could be resolved, e.g. orchestral/composer
  // credits Spotify has no portrait for.
  artistImageUrls: z.array(z.string()).default([]),
  accentColor: zColor().default("#ff5f6d"),
});

export type ThumbnailProps = z.infer<typeof thumbnailSchema>;
