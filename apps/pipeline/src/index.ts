import { resolveThemeForDay, weekdayFromDate } from "@blindtest/core";
import { loadChannelConfig } from "./load-channel-config.js";

const channelConfigPath = process.argv[2];
if (!channelConfigPath) {
  console.error("Usage: pipeline <path-to-channel-config.json>");
  process.exit(1);
}

const channel = await loadChannelConfig(channelConfigPath);
const today = resolveThemeForDay(channel.themes, weekdayFromDate(new Date()));

console.log(
  `[${channel.name}] Thème du jour : ${today.label} (${today.seedArtists.length} artiste(s) en config)`,
);
console.log("Le reste du pipeline (sélection, rendu, upload) n'est pas encore implémenté.");
