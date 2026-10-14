import type { YoutubeClient } from "@blindtest/youtube";

export interface UploadedVideoRow {
  readonly id: string;
  readonly channelId: string;
  readonly themeId: string;
  readonly youtubeVideoId: string;
  readonly createdAt: string;
}

export interface BlockedVideo extends UploadedVideoRow {
  readonly blockedRegionCount: number;
}

// YouTube's own `contentDetails.regionRestriction.blocked` list runs to a
// few hundred entries when it's used at all. Confirmed live: a worldwide
// Content ID block lists 204 regions, while an ordinary regional licensing
// gap lists a small handful (2). This threshold sits with a wide margin on
// both sides of that real-world split.
export const WORLDWIDE_BLOCK_THRESHOLD = 100;

/**
 * Flags any already-published video whose region-block list looks like a
 * worldwide Content ID block rather than an ordinary regional restriction.
 * The Data API exposes the block count directly (see
 * YoutubeClient.getBlockedRegionCounts) but never *which* claim/track
 * caused it — that still needs a human reading YouTube Studio's Copyright
 * tab, same as replace-blocked-tracks.ts has always required.
 */
export async function findBlockedVideos(
  youtube: YoutubeClient,
  rows: readonly UploadedVideoRow[],
  threshold = WORLDWIDE_BLOCK_THRESHOLD,
): Promise<BlockedVideo[]> {
  if (rows.length === 0) {
    return [];
  }
  const counts = await youtube.getBlockedRegionCounts(rows.map((row) => row.youtubeVideoId));
  return rows
    .filter((row) => (counts.get(row.youtubeVideoId) ?? 0) >= threshold)
    .map((row) => ({ ...row, blockedRegionCount: counts.get(row.youtubeVideoId) ?? 0 }));
}
