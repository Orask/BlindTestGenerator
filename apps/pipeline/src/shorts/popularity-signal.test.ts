import type { DeezerClient } from "@blindtest/deezer";
import { describe, expect, it, vi } from "vitest";
import { popularitySignal } from "./popularity-signal.js";

describe("popularitySignal", () => {
  it("returns the Deezer rank when a match is found", async () => {
    const deezer: DeezerClient = { getTrackPopularityRank: vi.fn().mockResolvedValue(850000) };

    const result = await popularitySignal(deezer, "Papaoutai", "Stromae", 0);

    expect(result).toBe(850000);
  });

  it("returns 0 (lowest possible) when Deezer has no confident match", async () => {
    const deezer: DeezerClient = { getTrackPopularityRank: vi.fn().mockResolvedValue(null) };

    const result = await popularitySignal(deezer, "Obscure Title", "Obscure Artist", 0);

    expect(result).toBe(0);
  });
});
