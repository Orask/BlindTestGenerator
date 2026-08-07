import { fileURLToPath } from "node:url";
import { createClientsFromEnv } from "./create-clients.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { runPipeline } from "./pipeline.js";

const channelConfigPath = process.argv[2];
if (!channelConfigPath) {
  console.error("Usage: pipeline <path-to-channel-config.json>");
  process.exit(1);
}

const channel = await loadChannelConfig(channelConfigPath);
const clients = createClientsFromEnv();

const tracksPerEpisode = process.env["PIPELINE_TRACK_COUNT"]
  ? Number(process.env["PIPELINE_TRACK_COUNT"])
  : undefined;

await runPipeline(channel, {
  ...clients,
  dbPath: fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url)),
  outputDir: fileURLToPath(new URL("../../../data/renders/", import.meta.url)),
  tracksPerEpisode,
});
