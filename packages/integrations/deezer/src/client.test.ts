import { describe, expect, it, vi } from "vitest";
import { createDeezerClient } from "./client.js";

function fakeFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

describe("createDeezerClient.findPreviewByTitleAndArtist", () => {
  it("returns the preview URL for a matching track", async () => {
    const client = createDeezerClient(
      fakeFetch({
        data: [
          {
            title: "Dernière danse",
            artist: { name: "Indila" },
            preview: "https://cdnt-preview.dzcdn.net/api/1/1/abc.mp3",
          },
        ],
      }),
    );

    const result = await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");

    expect(result).toEqual({ previewUrl: "https://cdnt-preview.dzcdn.net/api/1/1/abc.mp3" });
  });

  it("matches ignoring case and accents", async () => {
    const client = createDeezerClient(
      fakeFetch({
        data: [
          {
            title: "derniere danse",
            artist: { name: "INDILA" },
            preview: "https://example.com/preview.mp3",
          },
        ],
      }),
    );

    const result = await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");

    expect(result).not.toBeNull();
  });

  it("skips candidates whose artist doesn't plausibly match", async () => {
    const client = createDeezerClient(
      fakeFetch({
        data: [
          {
            title: "Dernière danse",
            artist: { name: "Some Cover Band" },
            preview: "https://example.com/cover.mp3",
          },
        ],
      }),
    );

    const result = await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");

    expect(result).toBeNull();
  });

  it("returns null when there is no plausible match", async () => {
    const client = createDeezerClient(fakeFetch({ data: [] }));

    const result = await client.findPreviewByTitleAndArtist("Nonexistent Song", "Nobody");

    expect(result).toBeNull();
  });

  it("returns null when the matching track has no preview", async () => {
    const client = createDeezerClient(
      fakeFetch({
        data: [{ title: "Dernière danse", artist: { name: "Indila" }, preview: "" }],
      }),
    );

    const result = await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");

    expect(result).toBeNull();
  });

  it("throws on an HTTP-level failure", async () => {
    const client = createDeezerClient(fakeFetch({}, false, 500));

    await expect(client.findPreviewByTitleAndArtist("Title", "Artist")).rejects.toThrow(
      "Deezer search failed",
    );
  });

  it("throws on a Deezer API-level error (e.g. quota exceeded)", async () => {
    const client = createDeezerClient(
      fakeFetch({ error: { type: "Exception", message: "Quota limit exceeded", code: 4 } }),
    );

    await expect(client.findPreviewByTitleAndArtist("Title", "Artist")).rejects.toThrow(
      "Quota limit exceeded",
    );
  });
});
