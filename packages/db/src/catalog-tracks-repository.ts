import type Database from "better-sqlite3";

export type CatalogTrackSource = "seed_artist" | "curated" | "discovered";
export type CatalogTrackStatus =
  "discovered" | "verified" | "audio_ready" | "ineligible" | "blocked";

export interface CatalogTrackNeedingAudioCheck {
  readonly spotifyTrackId: string;
  readonly title: string;
  readonly artist: string;
}

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

/**
 * A row still needs an audio check once it's past pure discovery
 * ('discovered' or 'verified') and hasn't been checked yet — 'audio_ready',
 * 'ineligible' and 'blocked' rows are all settled outcomes and never
 * revisited here.
 */
export function getCatalogTracksNeedingAudioCheck(
  db: Database.Database,
  themeId: string,
  limit: number,
): CatalogTrackNeedingAudioCheck[] {
  return db
    .prepare<[string, number], { spotify_track_id: string; title: string; artist: string }>(
      `SELECT spotify_track_id, title, artist FROM catalog_tracks
       WHERE theme_id = ? AND status IN ('discovered', 'verified') AND audio_checked_at IS NULL
       LIMIT ?`,
    )
    .all(themeId, limit)
    .map((row) => ({
      spotifyTrackId: row.spotify_track_id,
      title: row.title,
      artist: row.artist,
    }));
}

export function markCatalogTrackAudioChecked(
  db: Database.Database,
  themeId: string,
  spotifyTrackId: string,
  outcome: { readonly status: "audio_ready" | "ineligible"; readonly ineligibleReason?: string },
  checkedAt: Date = new Date(),
): void {
  db.prepare(
    `UPDATE catalog_tracks
     SET status = @status, ineligible_reason = @ineligibleReason, audio_checked_at = @checkedAt
     WHERE theme_id = @themeId AND spotify_track_id = @spotifyTrackId`,
  ).run({
    themeId,
    spotifyTrackId,
    status: outcome.status,
    ineligibleReason: outcome.ineligibleReason ?? null,
    checkedAt: checkedAt.toISOString(),
  });
}

export function countAudioReadyCatalogTracks(db: Database.Database, themeId: string): number {
  const row = db
    .prepare<[string], { count: number }>(
      "SELECT COUNT(*) AS count FROM catalog_tracks WHERE theme_id = ? AND status = 'audio_ready'",
    )
    .get(themeId);
  return row?.count ?? 0;
}
