import type { AnthropicClient } from "@blindtest/anthropic";
import type { Track } from "@blindtest/core";
import { describe, expect, it, vi } from "vitest";
import type { EpisodeTrack } from "./build-episode-tracks.js";
import { reviewEpisode } from "./review-episode.js";

function track(id: string, artist = `Artist ${id}`): EpisodeTrack {
  const base: Track = {
    id,
    title: `Title ${id}`,
    artist,
    artistNames: [artist],
    albumCoverUrl: "",
  };
  return { ...base, audioUrl: `https://preview.example.com/${id}.m4a` };
}

function fakeAnthropic(complete: AnthropicClient["complete"]): AnthropicClient {
  return { complete };
}

describe("reviewEpisode", () => {
  it("applies a valid removal + reorder from the AI", async () => {
    // 10 tracks so removing 1 (10%) stays comfortably under the 20% safety
    // cap — a dedicated test below covers what happens when it's exceeded.
    const tracks = Array.from({ length: 10 }, (_, i) => track(String(i + 1)));
    const keepReversed = Array.from({ length: 9 }, (_, i) => 10 - i); // [10, 9, ..., 2]
    const anthropic = fakeAnthropic(
      vi
        .fn()
        .mockResolvedValue(
          JSON.stringify({ remove: [1], order: keepReversed, notes: "Hors thème" }),
        ),
    );

    const result = await reviewEpisode(anthropic, {
      themeLabel: "Années 2000",
      tracks,
      recentTracks: [],
    });

    expect(result.tracks.map((t) => t.id)).toEqual(keepReversed.map(String));
    expect(result.removed.map((t) => t.id)).toEqual(["1"]);
    expect(result.notes).toBe("Hors thème");
  });

  it("keeps everything unchanged when nothing is flagged for removal", async () => {
    const tracks = [track("1"), track("2")];
    const anthropic = fakeAnthropic(
      vi.fn().mockResolvedValue(JSON.stringify({ remove: [], order: [1, 2], notes: "" })),
    );

    const result = await reviewEpisode(anthropic, {
      themeLabel: "Années 2000",
      tracks,
      recentTracks: [],
    });

    expect(result.tracks.map((t) => t.id)).toEqual(["1", "2"]);
    expect(result.removed).toEqual([]);
    expect(result.notes).toBeUndefined();
  });

  it("strips a markdown code fence around the JSON", async () => {
    const tracks = [track("1"), track("2")];
    const anthropic = fakeAnthropic(
      vi.fn().mockResolvedValue('```json\n{"remove": [], "order": [1, 2]}\n```'),
    );

    const result = await reviewEpisode(anthropic, {
      themeLabel: "Années 2000",
      tracks,
      recentTracks: [],
    });

    expect(result.tracks.map((t) => t.id)).toEqual(["1", "2"]);
  });

  it("falls back to the original list when the API call throws", async () => {
    const tracks = [track("1"), track("2")];
    const anthropic = fakeAnthropic(vi.fn().mockRejectedValue(new Error("network error")));

    const result = await reviewEpisode(anthropic, {
      themeLabel: "Années 2000",
      tracks,
      recentTracks: [],
    });

    expect(result.tracks).toEqual(tracks);
    expect(result.removed).toEqual([]);
  });

  it("falls back to the original list when the response isn't valid JSON", async () => {
    const tracks = [track("1"), track("2")];
    const anthropic = fakeAnthropic(vi.fn().mockResolvedValue("not json at all"));

    const result = await reviewEpisode(anthropic, {
      themeLabel: "Années 2000",
      tracks,
      recentTracks: [],
    });

    expect(result.tracks).toEqual(tracks);
  });

  it("falls back when order+remove don't exactly partition every track", async () => {
    const tracks = [track("1"), track("2"), track("3")];
    const anthropic = fakeAnthropic(
      vi.fn().mockResolvedValue(JSON.stringify({ remove: [1], order: [2] })), // missing track 3
    );

    const result = await reviewEpisode(anthropic, {
      themeLabel: "Années 2000",
      tracks,
      recentTracks: [],
    });

    expect(result.tracks).toEqual(tracks);
  });

  it("falls back when a track number appears in both remove and order", async () => {
    const tracks = [track("1"), track("2")];
    const anthropic = fakeAnthropic(
      vi.fn().mockResolvedValue(JSON.stringify({ remove: [1], order: [1, 2] })),
    );

    const result = await reviewEpisode(anthropic, {
      themeLabel: "Années 2000",
      tracks,
      recentTracks: [],
    });

    expect(result.tracks).toEqual(tracks);
  });

  it("falls back when an out-of-range track number is given", async () => {
    const tracks = [track("1"), track("2")];
    const anthropic = fakeAnthropic(
      vi.fn().mockResolvedValue(JSON.stringify({ remove: [], order: [1, 2, 99] })),
    );

    const result = await reviewEpisode(anthropic, {
      themeLabel: "Années 2000",
      tracks,
      recentTracks: [],
    });

    expect(result.tracks).toEqual(tracks);
  });

  it("distrusts a review that wants to remove too large a share of the episode", async () => {
    const tracks = Array.from({ length: 10 }, (_, i) => track(String(i + 1)));
    // Removing 3/10 (30%) exceeds the 20% safety cap.
    const anthropic = fakeAnthropic(
      vi.fn().mockResolvedValue(
        JSON.stringify({
          remove: [1, 2, 3],
          order: [4, 5, 6, 7, 8, 9, 10],
        }),
      ),
    );

    const result = await reviewEpisode(anthropic, {
      themeLabel: "Années 2000",
      tracks,
      recentTracks: [],
    });

    expect(result.tracks).toEqual(tracks);
    expect(result.removed).toEqual([]);
  });

  it("includes recent-week history in the prompt for context", async () => {
    const complete = vi.fn().mockResolvedValue(JSON.stringify({ remove: [], order: [1] }));
    const anthropic = fakeAnthropic(complete);

    await reviewEpisode(anthropic, {
      themeLabel: "Rap FR",
      tracks: [track("1")],
      recentTracks: [{ title: "Old Hit", artist: "Some Rapper" }],
    });

    const { prompt } = complete.mock.calls[0]![0] as { prompt: string };
    expect(prompt).toContain("Old Hit");
    expect(prompt).toContain("Some Rapper");
  });
});
