import { zColor } from "@remotion/zod-types";
import { z } from "zod";

export const trackSchema = z.object({
  title: z.string(),
  artist: z.string(),
  albumCoverUrl: z.string(),
  audioUrl: z.string().optional(),
});

export const episodeSchema = z.object({
  tracks: z.array(trackSchema).min(1),
  accentColors: z
    .array(zColor())
    .min(1)
    .default(["#ff5f6d", "#4facfe", "#f6d365", "#a18cd1", "#43e97b"]),
});

export type Track = z.infer<typeof trackSchema>;
export type EpisodeProps = z.infer<typeof episodeSchema>;
