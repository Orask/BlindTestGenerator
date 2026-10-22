import { readFileSync } from "node:fs";
import { parseCopyrightClaimsPage } from "./parse-copyright-claims.js";

const [textFilePath, channelConfigPath, videoRowId] = process.argv.slice(2);
if (!textFilePath) {
  console.error(
    "Usage: parse-copyright-claims-cli <fichier-texte-copié-de-Studio> [channel-config.json] [video-row-id]\n" +
      "Dans YouTube Studio > onglet Détection de contenus, sélectionne toute la page (Ctrl/Cmd+A), " +
      "copie, colle dans un fichier texte, puis passe son chemin ici.",
  );
  process.exit(1);
}

const rawText = readFileSync(textFilePath, "utf8");
const result = parseCopyrightClaimsPage(rawText);

if (!result.videoGloballyBlocked) {
  console.log(
    "D'après la bannière de Studio, cette vidéo n'est PAS bloquée dans le monde entier " +
      "(juste une restriction régionale, ou aucun impact) — aucune action nécessaire.",
  );
  process.exit(0);
}

if (result.worldwideBlockingClaims.length === 0) {
  console.error(
    "La bannière dit la vidéo bloquée dans le monde entier, mais aucune revendication individuelle " +
      'ne porte la mention "bloquée dans le monde entier" — vérifie le texte collé, le format a peut-être changé.',
  );
  process.exit(1);
}

console.log(
  `${result.worldwideBlockingClaims.length} morceau(x) responsable(s) du blocage mondial :`,
);
for (const claim of result.worldwideBlockingClaims) {
  console.log(`  - "${claim.title}" — ${claim.artist}`);
}

if (channelConfigPath && videoRowId) {
  const blockArgs = result.worldwideBlockingClaims
    .map((claim) => `--block "${claim.title}||${claim.artist}"`)
    .join(" ");
  console.log("\nCommande prête à lancer :\n");
  console.log(
    `node dist/replace-blocked-tracks.js ${channelConfigPath} ${videoRowId} ${blockArgs}`,
  );
}
