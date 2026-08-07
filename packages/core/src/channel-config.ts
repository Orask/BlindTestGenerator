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
  spotifySeed: z.string().min(1),
  youtubePlaylistId: z.string().nullable(),
});

const channelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  language: z.string().min(1),
  visibility: visibilitySchema,
  themes: z.array(channelThemeSchema).min(1),
});

export type Weekday = z.infer<typeof weekdaySchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type ChannelTheme = z.infer<typeof channelThemeSchema>;
export type ChannelConfig = z.infer<typeof channelConfigSchema>;

export function parseChannelConfig(json: unknown): ChannelConfig {
  return channelConfigSchema.parse(json);
}
