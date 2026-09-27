import { zColor } from "@remotion/zod-types";
import { z } from "zod";
import { trackSchema } from "./episode-schema";

export const shortSchema = z.object({
  themeLabel: z.string(),
  // A short handful of an already-published episode's opening tracks (see
  // generate-short.ts) — never the full 40-60, that's what the long-form
  // episode is for. Shorts trade breadth for a fast, complete-feeling mini
  // game that still ends with a reason to go watch the full thing.
  tracks: z.array(trackSchema).min(1),
  // The full episode's track count, shown in the outro CTA ("la suite sur
  // la chaîne, 40 morceaux") — distinct from tracks.length, which is only
  // the short's own subset. Omitted for a Short that doesn't tease a
  // specific episode (see apps/pipeline/src/shorts/ "traffic" types),
  // which gets a generic "nouveau chaque jour" outro instead.
  fullEpisodeTrackCount: z.number().int().positive().optional(),
  accentColors: z
    .array(zColor())
    .min(1)
    .default(["#ff5f6d", "#4facfe", "#f6d365", "#a18cd1", "#43e97b"]),
});

export type ShortProps = z.infer<typeof shortSchema>;
