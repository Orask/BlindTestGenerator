import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { upsertCatalogTrack } from "./catalog-tracks-repository.js";
import { upsertChannel, upsertChannelTheme } from "./channel-repository.js";
import { SCHEMA_SQL } from "./schema.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  upsertChannel(db, {
    id: "blindtest-fr",
    name: "BlindTest FR",
    language: "fr",
    visibility: "private",
  });
  upsertChannelTheme(db, {
    id: "rap-fr",
    channelId: "blindtest-fr",
    day: "monday",
    label: "Rap FR",
  });
  upsertChannelTheme(db, {
    id: "variete-actuelle",
    channelId: "blindtest-fr",
    day: "tuesday",
    label: "Variété actuelle",
  });
});

function row(themeId: string, spotifyTrackId: string) {
  return db
    .prepare("SELECT * FROM catalog_tracks WHERE theme_id = ? AND spotify_track_id = ?")
    .get(themeId, spotifyTrackId) as Record<string, unknown> | undefined;
}

describe("upsertCatalogTrack", () => {
  it("inserts a new row defaulting to status 'discovered'", () => {
    upsertCatalogTrack(db, {
      themeId: "rap-fr",
      spotifyTrackId: "id-1",
      title: "Avant toi",
      artist: "Vitaa, Slimane",
      artistNames: ["Vitaa", "Slimane"],
      source: "curated",
      cacheKey: "avant toi|vitaa",
      discoveredAt: new Date("2026-10-22T10:00:00.000Z"),
    });

    expect(row("rap-fr", "id-1")).toMatchObject({
      title: "Avant toi",
      artist: "Vitaa, Slimane",
      artist_names: JSON.stringify(["Vitaa", "Slimane"]),
      source: "curated",
      status: "discovered",
    });
  });

  it("refreshes title/artist on a re-discovery without resetting an existing status", () => {
    upsertCatalogTrack(db, {
      themeId: "rap-fr",
      spotifyTrackId: "id-1",
      title: "Avant toi",
      artist: "Vitaa",
      artistNames: ["Vitaa"],
      source: "seed_artist",
      cacheKey: "avant toi|vitaa",
      discoveredAt: new Date("2026-10-22T10:00:00.000Z"),
    });
    db.prepare(
      "UPDATE catalog_tracks SET status = 'audio_ready' WHERE spotify_track_id = 'id-1'",
    ).run();

    upsertCatalogTrack(db, {
      themeId: "rap-fr",
      spotifyTrackId: "id-1",
      title: "Avant toi (Remastered)",
      artist: "Vitaa, Slimane",
      artistNames: ["Vitaa", "Slimane"],
      source: "seed_artist",
      cacheKey: "avant toi|vitaa",
      discoveredAt: new Date("2026-10-23T10:00:00.000Z"),
    });

    expect(row("rap-fr", "id-1")).toMatchObject({
      title: "Avant toi (Remastered)",
      artist: "Vitaa, Slimane",
      status: "audio_ready",
    });
  });

  it("keeps the same track separate across two different themes", () => {
    upsertCatalogTrack(db, {
      themeId: "rap-fr",
      spotifyTrackId: "id-1",
      title: "Avant toi",
      artist: "Vitaa",
      artistNames: ["Vitaa"],
      source: "curated",
      cacheKey: "avant toi|vitaa",
      discoveredAt: new Date("2026-10-22T10:00:00.000Z"),
    });
    upsertCatalogTrack(db, {
      themeId: "variete-actuelle",
      spotifyTrackId: "id-1",
      title: "Avant toi",
      artist: "Vitaa",
      artistNames: ["Vitaa"],
      source: "curated",
      cacheKey: "avant toi|vitaa",
      discoveredAt: new Date("2026-10-22T10:00:00.000Z"),
    });

    expect(row("rap-fr", "id-1")).toBeDefined();
    expect(row("variete-actuelle", "id-1")).toBeDefined();
  });
});
