import type { ChannelConfig, ChannelTheme } from "@blindtest/core";

/**
 * Every one-off CLI script that operates on an already-published video
 * (replace-blocked-tracks, recut-episode, reupload-video, set-thumbnail)
 * needs to resolve that video's theme_id back to the matching theme in the
 * channel config on disk — factored out once here instead of repeating the
 * same find-or-throw in each script.
 */
export function findThemeOrThrow(channel: ChannelConfig, themeId: string): ChannelTheme {
  const theme = channel.themes.find((candidate) => candidate.id === themeId);
  if (!theme) {
    throw new Error(`Theme ${themeId} not found in channel config`);
  }
  return theme;
}
