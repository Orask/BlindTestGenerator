import { fileURLToPath } from "node:url";
import { createClientsFromEnv } from "./create-clients.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { runPipeline, runWeeklyBatch } from "./pipeline.js";

const channelConfigPath = process.argv[2];
const mode = process.argv[3];
if (!channelConfigPath) {
  console.error("Usage: pipeline <path-to-channel-config.json> [--week]");
  process.exit(1);
}

const channel = await loadChannelConfig(channelConfigPath);
const clients = createClientsFromEnv();

const tracksPerEpisode = process.env["PIPELINE_TRACK_COUNT"]
  ? Number(process.env["PIPELINE_TRACK_COUNT"])
  : undefined;

const deps = {
  ...clients,
  dbPath: fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url)),
  outputDir: fileURLToPath(new URL("../../../data/renders/", import.meta.url)),
  channelConfigPath,
  tracksPerEpisode,
};

if (mode === "--week") {
  await runWeeklyBatch(channel, deps);
} else {
  await runPipeline(channel, deps);
}
