import { createClientsFromEnv } from "./create-clients.js";
import { loadChannelConfig } from "./load-channel-config.js";
import { appendCuratedTracks } from "./persist-curated-tracks.js";
import { proposeCuratedTracksForArtist } from "./propose-curated-tracks.js";

const DEFAULT_COUNT_PER_ARTIST = 3;

const args = process.argv.slice(2);
const applyIndex = args.indexOf("--apply");
const apply = applyIndex !== -1;
if (apply) {
  args.splice(applyIndex, 1);
}

const [channelConfigPath, themeId, countArg, ...artists] = args;
if (!channelConfigPath || !themeId || artists.length === 0) {
  console.error(
    "Usage: propose-curated-tracks-cli <channel-config.json> <theme-id> <count-per-artist> " +
      '<"Artiste 1"> ["Artiste 2" ...] [--apply]\n' +
      "Sans --apply : affiche seulement les propositions vérifiées sur Spotify, n'écrit rien.\n" +
      "Avec --apply : les ajoute aussi au curatedTracks du thème dans le fichier de config.",
  );
  process.exit(1);
}

const count = countArg ? Number(countArg) : DEFAULT_COUNT_PER_ARTIST;
if (!Number.isInteger(count) || count <= 0) {
  console.error(`count-per-artist invalide : ${countArg}`);
  process.exit(1);
}

const channel = await loadChannelConfig(channelConfigPath);
const theme = channel.themes.find((t) => t.id === themeId);
if (!theme) {
  console.error(`Aucun thème "${themeId}" trouvé dans ${channelConfigPath}.`);
  process.exit(1);
}

const { spotify, anthropic } = createClientsFromEnv();
if (!anthropic) {
  console.error("ANTHROPIC_API_KEY non configuré — impossible de proposer des morceaux.");
  process.exit(1);
}

for (const artist of artists) {
  console.log(`\nMorceaux proposés pour "${artist}" (thème "${theme.label}") :`);
  const proposed = await proposeCuratedTracksForArtist(
    anthropic,
    spotify,
    artist,
    theme.label,
    count,
  );
  if (proposed.length === 0) {
    console.log("  (aucun morceau proposé n'a pu être vérifié sur Spotify)");
    continue;
  }
  for (const track of proposed) {
    console.log(`  - "${track.title}" — ${track.artist}`);
  }
  if (apply) {
    await appendCuratedTracks(channelConfigPath, themeId, proposed);
  }
}

if (apply) {
  console.log(
    `\nAjouté${artists.length > 1 ? "s" : ""} à curatedTracks dans ${channelConfigPath}.`,
  );
} else {
  console.log("\n(Rien n'a été écrit — relance avec --apply pour ajouter ces morceaux au thème.)");
}
