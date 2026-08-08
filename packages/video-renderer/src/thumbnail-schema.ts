import { zColor } from "@remotion/zod-types";
import { z } from "zod";

export const thumbnailSchema = z.object({
  themeLabel: z.string(),
  trackCount: z.number().int().positive(),
  coverImageUrls: z.array(z.string()).min(1),
  accentColor: zColor().default("#ff5f6d"),
});

export type ThumbnailProps = z.infer<typeof thumbnailSchema>;
