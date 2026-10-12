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
  // Free-text Spotify artist-search query (e.g. "rap francais") used to
  // discover new candidate artists when seedArtists runs short — see
  // apps/pipeline/src/discover-artists.ts. Optional: a theme without one
  // just fails as before on a shortfall, instead of the pipeline guessing a
  // query that was never verified to return good results.
  discoveryQuery: z.string().min(1).optional(),
  // Specific (title, artist) pairs pulled in via exact-match search
  // (SpotifyClient.searchTrackByTitleAndArtist) instead of a loose
  // artist-name search — for themes where "this artist's top tracks" misses
  // the mark entirely (confirmed live: a movie/TV/anime-theme theme mostly
  // surfaced deep-cut soundtrack tracks nobody recognizes, because the
  // recognizable unit is one specific famous piece, not a composer's broader
  // catalog). Optional: most themes don't need this, seedArtists alone works.
  curatedTracks: z
    .array(z.object({ title: z.string().min(1), artist: z.string().min(1) }))
    .optional(),
  // Absolute calendar-year bound for decade-bound themes ("Années 80") —
  // a candidate released outside this range is a thematic mismatch
  // regardless of how relevant the artist otherwise is (an artist active
  // across decades can have tracks from any era). Mutually exclusive in
  // practice with recencyWindowYears below; never both on the same theme.
  releaseYearRange: z
    .object({ min: z.number().int().optional(), max: z.number().int().optional() })
    .optional(),
  // Rolling "released within the last N years" bound for genre themes
  // that aren't decade-bound ("Rap FR", "Variété actuelle") — confirmed
  // live (YouTube comments, 2026-10-12): viewers complained about tracks
  // "not from their generation" mixed into a genre theme that spans
  // decades by design. Computed against the current date at build time,
  // not a fixed year, so it never goes stale as the channel keeps running.
  recencyWindowYears: z.number().int().positive().optional(),
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
