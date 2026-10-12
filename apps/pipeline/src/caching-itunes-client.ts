import { getCachedItunesPreview, setCachedItunesPreview } from "@blindtest/db";
import type { ItunesClient, ItunesPreviewResult } from "@blindtest/itunes";
import type Database from "better-sqlite3";

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

function cacheKey(title: string, artist: string): string {
  return `${normalize(title)}|${normalize(artist)}`;
}

/**
 * A single long episode re-resolves ~150-200 (title, artist) pairs through
 * iTunes every run — including tracks already resolved in a previous
 * episode, since nothing remembered the result (confirmed live, 2026-10-12:
 * several runs ballooned to 18-48min, almost certainly iTunes retry storms
 * on its informal ~20/min rate limit, which this exact kind of redundant
 * re-querying makes worse than it needs to be). Caches by (title, artist)
 * — iTunes Search has no concept of "this exact recording" the way
 * Spotify's track id does, only a text search, so the same normalized pair
 * always resolves to the same result regardless of which Spotify track id
 * or theme asked for it.
 *
 * Not channel-scoped on purpose: the same song has the same iTunes preview
 * no matter which channel is asking, so one shared cache benefits every
 * channel that ever picks it — the actual point once more than one
 * channel shares this database (see docs/CAHIER_DES_CHARGES.md's
 * scalability notes, prepared ahead of actually running >1 channel).
 */
export function createCachingItunesClient(
  db: Database.Database,
  inner: ItunesClient,
): ItunesClient {
  return {
    async findPreviewByTitleAndArtist(
      title: string,
      artist: string,
    ): Promise<ItunesPreviewResult | null> {
      const key = cacheKey(title, artist);
      const cached = getCachedItunesPreview(db, key);
      if (cached !== undefined) {
        return cached === null ? null : { previewUrl: cached };
      }

      const result = await inner.findPreviewByTitleAndArtist(title, artist);
      setCachedItunesPreview(db, key, result?.previewUrl ?? null);
      return result;
    },
  };
}
