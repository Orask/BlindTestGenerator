import { readFile, writeFile } from "node:fs/promises";

/**
 * Appends newly-discovered, live-verified artists to a theme's seedArtists
 * in the channel config file on disk, so a shortfall fixes itself
 * permanently instead of recurring every time that theme's pool thins out
 * again. Mirrors the existing pattern of committing back mutated state
 * (see .github/workflows/daily-pipeline.yml's "Persist database state"
 * step) — the workflow commits this file alongside the database.
 *
 * Reads/writes the raw JSON rather than going through parseChannelConfig,
 * since this only ever appends strings to an already-valid array.
 */
export async function appendDiscoveredArtists(
  channelConfigPath: string,
  themeId: string,
  newArtists: readonly string[],
): Promise<void> {
  if (newArtists.length === 0) {
    return;
  }

  const raw = await readFile(channelConfigPath, "utf-8");
  const config = JSON.parse(raw) as { themes: { id: string; seedArtists: string[] }[] };
  const theme = config.themes.find((t) => t.id === themeId);
  if (!theme) {
    return;
  }

  theme.seedArtists.push(...newArtists);
  await writeFile(channelConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}
