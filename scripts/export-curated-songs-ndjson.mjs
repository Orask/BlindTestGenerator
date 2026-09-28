#!/usr/bin/env node
// Exports every { title, artist } pair currently sitting in a channel
// config's curatedTracks (grouped by artist) as the NDJSON format
// curate-songs-cli.ts expects, so the whole curated catalogue can be
// re-verified against Spotify's real catalog in one pass — not just newly
// added pairs. Read-only: it never edits channels/*.json itself.
//
// Usage:
//   node scripts/export-curated-songs-ndjson.mjs channels/blindtest-fr.json > /tmp/curated-audit.ndjson
//   node apps/pipeline/dist/curate-songs-cli.js /tmp/curated-audit.ndjson /tmp/curated-verified.json
//
// The second step needs SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET in the
// environment and network access to Spotify — run it wherever those are
// available (local machine, or a cloud session with the secrets configured).
// Its console output lists every pair Spotify couldn't confirm ("rejected"),
// which is exactly the "titres à revérifier" list.

import { readFile } from "node:fs/promises";

const configPath = process.argv[2];
if (!configPath) {
  console.error("Usage: export-curated-songs-ndjson.mjs <channel-config.json>");
  process.exit(1);
}

const config = JSON.parse(await readFile(configPath, "utf-8"));

const byArtist = new Map();
for (const theme of config.themes ?? []) {
  for (const { title, artist } of theme.curatedTracks ?? []) {
    if (!byArtist.has(artist)) {
      byArtist.set(artist, new Set());
    }
    byArtist.get(artist).add(title);
  }
}

for (const [artist, titles] of byArtist) {
  console.log(JSON.stringify({ artist, songs: [...titles] }));
}
