import { readFile, writeFile } from "node:fs/promises";
import { SpotifyTokenProvider, createSpotifyClient } from "@blindtest/spotify";
import { parseCuratedSongsNdjson } from "./parse-curated-songs.js";
import { verifyCuratedSongs } from "./verify-curated-songs.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const inputPath = process.argv[2];
const outputPath = process.argv[3];
if (!inputPath || !outputPath) {
  console.error("Usage: curate-songs-cli <input.ndjson> <output.json>");
  console.error("  input.ndjson: one artist-songs JSON object per line (raw LLM output)");
  console.error("  output.json:  written as [{ artist, title, spotifyTrackId }, ...]");
  process.exit(1);
}

const raw = await readFile(inputPath, "utf-8");
const input = parseCuratedSongsNdjson(raw);

const tokenProvider = new SpotifyTokenProvider({
  clientId: requireEnv("SPOTIFY_CLIENT_ID"),
  clientSecret: requireEnv("SPOTIFY_CLIENT_SECRET"),
});
const spotify = createSpotifyClient(tokenProvider);

const totalSongs = Object.values(input).reduce((sum, titles) => sum + titles.length, 0);
console.log(
  `Vérification de ${totalSongs} morceaux pour ${Object.keys(input).length} artiste(s)...`,
);

// Checkpointed after every single song — a run this size takes many
// minutes, can hit a persistent rate limit that makes individual songs slow
// (each retry waits up to 30s, see fetchWithRetry), or need to be
// interrupted, so the output file always reflects the latest progress
// instead of only ever being written once, at the very end, all-or-nothing.
// A per-song line is also printed immediately, not batched — with only a
// handful of songs (e.g. a quick sanity-check run) batching by count alone
// could otherwise mean zero visible output for the entire run.
const { verified, rejected } = await verifyCuratedSongs(
  spotify,
  input,
  undefined,
  async (progress) => {
    const mark = progress.lastOutcome === "verified" ? "✓" : "✗";
    const errorSuffix =
      "error" in progress.last && progress.last.error ? ` (${progress.last.error})` : "";
    console.log(
      `  [${progress.done}/${progress.total}] ${mark} ${progress.last.title} — ` +
        `${progress.last.artist}${errorSuffix}`,
    );
    await writeFile(outputPath, `${JSON.stringify(progress.verified, null, 2)}\n`, "utf-8");
  },
);

console.log(`${verified.length} morceaux vérifiés, écrits dans ${outputPath}.`);
if (rejected.length > 0) {
  const failed = rejected.filter((r) => r.error);
  const notFound = rejected.filter((r) => !r.error);
  console.log(`${rejected.length} rejeté(s) :`);
  for (const { artist, title } of notFound) {
    console.log(`  - "${title}" — ${artist} (introuvable sur Spotify avec ce titre exact)`);
  }
  for (const { artist, title, error } of failed) {
    console.log(`  - "${title}" — ${artist} (échec de la recherche : ${error})`);
  }
  if (failed.length > 0) {
    console.log(
      `${failed.length} morceau(x) n'ont pas pu être vérifiés (erreur réseau/quota persistante malgré les tentatives automatiques).`,
    );
  }
}
