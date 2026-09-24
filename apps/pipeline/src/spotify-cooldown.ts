import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { getCooldownUntil, openDatabase, setCooldownUntil } from "@blindtest/db";

const SPOTIFY_SERVICE = "spotify";

/** Cooldown a previous run left behind (epoch ms), or undefined if Spotify is usable. */
export async function loadSpotifyCooldown(dbPath: string): Promise<number | undefined> {
  await mkdir(dirname(dbPath), { recursive: true });
  const db = openDatabase(dbPath);
  try {
    return getCooldownUntil(db, SPOTIFY_SERVICE)?.getTime();
  } finally {
    db.close();
  }
}

export function saveSpotifyCooldown(dbPath: string, blockedUntil: number): void {
  const db = openDatabase(dbPath);
  try {
    setCooldownUntil(db, SPOTIFY_SERVICE, new Date(blockedUntil));
  } finally {
    db.close();
  }
}
