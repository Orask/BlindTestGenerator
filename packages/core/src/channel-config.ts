import { z } from "zod";

const weekdaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);

const visibilitySchema = z.enum(["private", "unlisted", "public"]);

const channelThemeSchema = z.object({
  day: weekdaySchema,
  id: z.string().min(1),
  label: z.string().min(1),
  // Spotify locks down genre/playlist/recommendation-based discovery for new
  // apps (see docs/CAHIER_DES_CHARGES.md section 7bis) — searching by a
  // curated artist list is what's left that reliably surfaces well-known
  // songs.
  seedArtists: z.array(z.string().min(1)).min(1),
  youtubePlaylistId: z.string().nullable(),
});

const channelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(1),
  visibility: visibilitySchema,
  // Local hour (0-23) at which a batch-scheduled episode should go live —
  // only takes effect for scheduled publish (see generate-week.ts), applied
  // in the machine's local timezone.
  publishHourLocal: z.number().int().min(0).max(23).default(9),
  themes: z.array(channelThemeSchema).min(1),
});

export type Weekday = z.infer<typeof weekdaySchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type ChannelTheme = z.infer<typeof channelThemeSchema>;
export type ChannelConfig = z.infer<typeof channelConfigSchema>;

export function parseChannelConfig(json: unknown): ChannelConfig {
  return channelConfigSchema.parse(json);
}
