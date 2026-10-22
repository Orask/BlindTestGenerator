import { describe, expect, it, vi } from "vitest";
import { createMusicBrainzClient } from "./client.js";

function fakeFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

function recording(overrides: Record<string, unknown> = {}) {
  return {
    id: "3ee7c445-93b7-4156-ae9b-bacb751546c5",
    title: "Papaoutai",
    score: 100,
    "artist-credit": [{ name: "Stromae" }],
    ...overrides,
  };
}

describe("createMusicBrainzClient.findRecording", () => {
  it("returns a high-confidence, exact title+artist match", async () => {
    const client = createMusicBrainzClient(fakeFetch({ recordings: [recording()] }));

    const result = await client.findRecording("Papaoutai", "Stromae");

    expect(result).toEqual({
      id: "3ee7c445-93b7-4156-ae9b-bacb751546c5",
      title: "Papaoutai",
      disambiguation: "",
      score: 100,
    });
  });

  it("sends a descriptive User-Agent header", async () => {
    const fetchImpl = fakeFetch({ recordings: [recording()] });
    const client = createMusicBrainzClient(fetchImpl);

    await client.findRecording("Papaoutai", "Stromae");

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["User-Agent"]).toContain("BlindTestGenerator");
  });

  it("surfaces a recording's disambiguation when present", async () => {
    const client = createMusicBrainzClient(
      fakeFetch({ recordings: [recording({ disambiguation: "live version" })] }),
    );

    const result = await client.findRecording("Papaoutai", "Stromae");

    expect(result?.disambiguation).toBe("live version");
  });

  it("rejects a match below the confidence threshold", async () => {
    const client = createMusicBrainzClient(fakeFetch({ recordings: [recording({ score: 60 })] }));

    const result = await client.findRecording("Papaoutai", "Stromae");

    expect(result).toBeNull();
  });

  it("rejects a candidate whose title only loosely matches", async () => {
    const client = createMusicBrainzClient(
      fakeFetch({ recordings: [recording({ title: "Papaoutai (Live)" })] }),
    );

    const result = await client.findRecording("Papaoutai", "Stromae");

    expect(result).toBeNull();
  });

  it("rejects a candidate credited to a different artist", async () => {
    const client = createMusicBrainzClient(
      fakeFetch({ recordings: [recording({ "artist-credit": [{ name: "Someone Else" }] })] }),
    );

    const result = await client.findRecording("Papaoutai", "Stromae");

    expect(result).toBeNull();
  });

  it("returns null when nothing is found", async () => {
    const client = createMusicBrainzClient(fakeFetch({ recordings: [] }));

    const result = await client.findRecording("Nonexistent Song 12345", "Nobody At All");

    expect(result).toBeNull();
  });

  it("throws when the API responds with a non-OK status", async () => {
    const client = createMusicBrainzClient(fakeFetch({}, false, 503));

    await expect(client.findRecording("Papaoutai", "Stromae")).rejects.toThrow("503");
  });

  it("waits at least ~1.1s before making a second request", async () => {
    vi.useFakeTimers();
    const fetchImpl = fakeFetch({ recordings: [recording()] });
    const client = createMusicBrainzClient(fetchImpl);

    await client.findRecording("Papaoutai", "Stromae");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const second = client.findRecording("Alors on danse", "Stromae");
    await vi.advanceTimersByTimeAsync(1000);
    // Still throttled just before the 1.1s window elapses.
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(150);
    await second;
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
