import { fileURLToPath } from "node:url";
import { openDatabase } from "@blindtest/db";
import { createCachingItunesClient } from "./caching-itunes-client.js";
import { createClientsFromEnv } from "./create-clients.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { populateCatalogForTheme } from "./populate-catalog.js";

// Not wired to any cron/schedule yet — how often this should run per theme
// is an open decision (see /Users/lucaslordon/.claude/plans/hazy-stargazing-peach.md's
// "Questions ouvertes"), independent of this CLI existing and working.
const DEFAULT_TARGET_DEPTH = 120;

const [channelConfigPath, themeIdArg, targetDepthArg] = process.argv.slice(2);
if (!channelConfigPath) {
  console.error(
    "Usage: populate-catalog-cli <channel-config.json> [theme-id|all] [target-depth]\n" +
      "theme-id défaut : all (tous les thèmes du channel). target-depth défaut : " +
      DEFAULT_TARGET_DEPTH,
  );
  process.exit(1);
}

const targetDepth = targetDepthArg ? Number(targetDepthArg) : DEFAULT_TARGET_DEPTH;
if (!Number.isInteger(targetDepth) || targetDepth <= 0) {
  console.error(`target-depth invalide : ${targetDepthArg}`);
  process.exit(1);
}

const channel = await loadChannelConfig(channelConfigPath);
const themes =
  !themeIdArg || themeIdArg === "all"
    ? channel.themes
    : channel.themes.filter((theme) => theme.id === themeIdArg);
if (themes.length === 0) {
  console.error(`Aucun thème "${themeIdArg}" trouvé dans ${channelConfigPath}.`);
  process.exit(1);
}

const dbPath = fileURLToPath(new URL("../../../data/blindtest.sqlite", import.meta.url));
const db = openDatabase(dbPath);
const { spotify, itunes, anthropic } = createClientsFromEnv();
const cachedItunes = createCachingItunesClient(db, itunes);

let exitCode = 0;
for (const theme of themes) {
  console.log(`\n[${channel.name}] Peuplement du catalogue — ${theme.label}`);
  try {
    const result = await populateCatalogForTheme(
      db,
      spotify,
      cachedItunes,
      channelConfigPath,
      theme,
      targetDepth,
      undefined,
      anthropic,
    );
    console.log(
      `  découverts: ${result.discovered}, vérifiés iTunes: ${result.audioChecked} ` +
        `(prêts: ${result.promoted}, inéligibles: ${result.ineligible}, ` +
        `récupérés par repli IA: ${result.fallbackRecovered}), ` +
        `profondeur audio_ready: ${result.audioReadyDepth}/${targetDepth}` +
        (result.discoveryRan ? " — découverte lancée" : ""),
    );
  } catch (error) {
    console.error(`  Échec pour "${theme.label}" : ${(error as Error).message}`);
    exitCode = 1;
  }
}

process.exitCode = exitCode;
