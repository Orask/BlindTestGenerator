import type Database from "better-sqlite3";

/**
 * undefined = never looked up (cache miss, caller must hit iTunes).
 * null = looked up before and confirmed no preview exists for this pair —
 * still a cache hit, just a negative one.
 * string = the cached preview URL.
 */
export type CachedPreviewLookup = string | null | undefined;

export function getCachedItunesPreview(
  db: Database.Database,
  cacheKey: string,
): CachedPreviewLookup {
  const row = db
    .prepare<[string], { preview_url: string | null }>(
      "SELECT preview_url FROM itunes_preview_cache WHERE cache_key = ?",
    )
    .get(cacheKey);
  if (!row) {
    return undefined;
  }
  return row.preview_url;
}

export function setCachedItunesPreview(
  db: Database.Database,
  cacheKey: string,
  previewUrl: string | null,
  now: Date = new Date(),
): void {
  db.prepare(
    `INSERT INTO itunes_preview_cache (cache_key, preview_url, cached_at) VALUES (?, ?, ?)
     ON CONFLICT (cache_key) DO UPDATE SET preview_url = excluded.preview_url, cached_at = excluded.cached_at`,
  ).run(cacheKey, previewUrl, now.toISOString());
}
