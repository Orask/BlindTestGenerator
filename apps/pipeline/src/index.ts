import { fileURLToPath } from "node:url";
import { createClientsFromEnv } from "./create-clients.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { runPipeline, runWeeklyBatch } from "./pipeline.js";
import { loadSpotifyCooldown, saveSpotifyCooldown } from "./spotify-cooldown.js";

const channelConfigPath = process.argv[2];
const mode = process.argv[3];
if (!channelConfigPath) {
  console.error("Usage: pipeline <path-to-channel-config.json> [--week]");
  process.exit(1);
}

const channel = await loadChannelConfig(channelConfigPath);
const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const spotifyBlockedUntil = await loadSpotifyCooldown(dbPath);
if (spotifyBlockedUntil !== undefined) {
  console.warn(
    `Spotify en cooldown jusqu'à ${new Date(spotifyBlockedUntil).toISOString()} (détecté lors d'un run précédent).`,
  );
}
const clients = createClientsFromEnv({
  spotifyBlockedUntil,
  onSpotifyCooldown: (blockedUntil) => saveSpotifyCooldown(dbPath, blockedUntil),
});

const tracksPerEpisode = process.env["PIPELINE_TRACK_COUNT"]
  ? Number(process.env["PIPELINE_TRACK_COUNT"])
  : undefined;

const deps = {
  ...clients,
  dbPath,
  outputDir: fileURLToPath(new URL("../../../data/renders/", import.meta.url)),
  channelConfigPath,
  tracksPerEpisode,
};

if (mode === "--week") {
  await runWeeklyBatch(channel, deps);
} else {
  await runPipeline(channel, deps);
}
