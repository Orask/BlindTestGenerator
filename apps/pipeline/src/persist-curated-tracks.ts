import { readFile, writeFile } from "node:fs/promises";
import type { CuratedTrackSpec } from "./collect-curated-tracks.js";

/**
 * Appends newly-proposed, Spotify-verified curatedTracks to a theme's
 * config on disk — same pattern as persist-discovered-artists.ts's
 * appendDiscoveredArtists, for the same reason: a fix lands permanently in
 * the data instead of being redone by hand next time the theme runs thin.
 */
export async function appendCuratedTracks(
  channelConfigPath: string,
  themeId: string,
  newTracks: readonly CuratedTrackSpec[],
): Promise<void> {
  if (newTracks.length === 0) {
    return;
  }

  const raw = await readFile(channelConfigPath, "utf-8");
  const config = JSON.parse(raw) as {
    themes: { id: string; curatedTracks?: CuratedTrackSpec[] }[];
  };
  const theme = config.themes.find((t) => t.id === themeId);
  if (!theme) {
    return;
  }

  theme.curatedTracks = [...(theme.curatedTracks ?? []), ...newTracks];
  await writeFile(channelConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}
