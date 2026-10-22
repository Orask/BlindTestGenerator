import type Database from "better-sqlite3";

export type CatalogTrackSource = "seed_artist" | "curated" | "discovered";
export type CatalogTrackStatus =
  "discovered" | "verified" | "audio_ready" | "ineligible" | "blocked";

export interface UpsertCatalogTrackParams {
  readonly themeId: string;
  readonly spotifyTrackId: string;
  readonly title: string;
  readonly artist: string;
  readonly artistNames: readonly string[];
  readonly source: CatalogTrackSource;
  readonly cacheKey: string;
  readonly discoveredAt: Date;
}

/**
 * Shadow-write only for now (see schema.ts's comment on catalog_tracks):
 * refreshes title/artist/artistNames on a re-discovery without touching
 * status/ineligibleReason/verifiedAt/audioCheckedAt — a track rediscovered
 * tomorrow must not regress a richer status an earlier run already gave it.
 */
export function upsertCatalogTrack(db: Database.Database, params: UpsertCatalogTrackParams): void {
  db.prepare(
    `INSERT INTO catalog_tracks
       (theme_id, spotify_track_id, title, artist, artist_names, source, cache_key, discovered_at)
     VALUES (@themeId, @spotifyTrackId, @title, @artist, @artistNames, @source, @cacheKey, @discoveredAt)
     ON CONFLICT (theme_id, spotify_track_id) DO UPDATE SET
       title = excluded.title,
       artist = excluded.artist,
       artist_names = excluded.artist_names`,
  ).run({
    themeId: params.themeId,
    spotifyTrackId: params.spotifyTrackId,
    title: params.title,
    artist: params.artist,
    artistNames: JSON.stringify(params.artistNames),
    source: params.source,
    cacheKey: params.cacheKey,
    discoveredAt: params.discoveredAt.toISOString(),
  });
}
