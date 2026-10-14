import { describe, expect, it, vi } from "vitest";
import type { YoutubeClient } from "@blindtest/youtube";
import { findBlockedVideos, type UploadedVideoRow } from "./find-blocked-videos.js";

function row(overrides: Partial<UploadedVideoRow> = {}): UploadedVideoRow {
  return {
    id: "row-1",
    channelId: "blindtest-fr",
    themeId: "annees-80",
    youtubeVideoId: "abc123",
    createdAt: "2026-10-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("findBlockedVideos", () => {
  it("flags a video whose region-block count is at or above the threshold", async () => {
    const getBlockedRegionCounts = vi.fn().mockResolvedValue(new Map([["abc123", 204]]));
    const youtube = { getBlockedRegionCounts } as unknown as YoutubeClient;

    const result = await findBlockedVideos(youtube, [row()]);

    expect(result).toEqual([{ ...row(), blockedRegionCount: 204 }]);
  });

  it("does not flag an ordinary regional restriction", async () => {
    const getBlockedRegionCounts = vi.fn().mockResolvedValue(new Map([["abc123", 2]]));
    const youtube = { getBlockedRegionCounts } as unknown as YoutubeClient;

    const result = await findBlockedVideos(youtube, [row()]);

    expect(result).toEqual([]);
  });

  it("treats a video missing from the response as unblocked", async () => {
    const getBlockedRegionCounts = vi.fn().mockResolvedValue(new Map());
    const youtube = { getBlockedRegionCounts } as unknown as YoutubeClient;

    const result = await findBlockedVideos(youtube, [row()]);

    expect(result).toEqual([]);
  });

  it("returns early without calling the API when there are no rows", async () => {
    const getBlockedRegionCounts = vi.fn();
    const youtube = { getBlockedRegionCounts } as unknown as YoutubeClient;

    const result = await findBlockedVideos(youtube, []);

    expect(result).toEqual([]);
    expect(getBlockedRegionCounts).not.toHaveBeenCalled();
  });

  it("respects a custom threshold", async () => {
    const getBlockedRegionCounts = vi.fn().mockResolvedValue(new Map([["abc123", 5]]));
    const youtube = { getBlockedRegionCounts } as unknown as YoutubeClient;

    const result = await findBlockedVideos(youtube, [row()], 5);

    expect(result).toHaveLength(1);
  });
});
