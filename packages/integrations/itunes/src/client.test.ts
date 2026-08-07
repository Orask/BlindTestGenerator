import { describe, expect, it, vi } from "vitest";
import { createItunesClient } from "./client.js";

function fakeFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

describe("createItunesClient.findPreviewByTitleAndArtist", () => {
  it("returns the preview URL for a matching track", async () => {
    const client = createItunesClient(
      fakeFetch({
        resultCount: 1,
        results: [
          {
            trackName: "Dernière danse",
            artistName: "Indila",
            previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a",
          },
        ],
      }),
    );

    const result = await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");

    expect(result).toEqual({ previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a" });
  });

  it("matches ignoring case and accents", async () => {
    const client = createItunesClient(
      fakeFetch({
        resultCount: 1,
        results: [
          {
            trackName: "derniere danse",
            artistName: "INDILA",
            previewUrl: "https://example.com/preview.m4a",
          },
        ],
      }),
    );

    const result = await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");

    expect(result).not.toBeNull();
  });

  it("skips implausible matches even though iTunes always returns results", async () => {
    const client = createItunesClient(
      fakeFetch({
        resultCount: 2,
        results: [
          { trackName: "Something Unrelated", artistName: "Someone Else" },
          { trackName: "Also Unrelated", artistName: "Another Artist" },
        ],
      }),
    );

    const result = await client.findPreviewByTitleAndArtist(
      "This Song Does Not Exist 12345",
      "Nobody At All",
    );

    expect(result).toBeNull();
  });

  it("returns null when the matching track has no preview", async () => {
    const client = createItunesClient(
      fakeFetch({
        resultCount: 1,
        results: [{ trackName: "Dernière danse", artistName: "Indila" }],
      }),
    );

    const result = await client.findPreviewByTitleAndArtist("Dernière danse", "Indila");

    expect(result).toBeNull();
  });

  it("throws on an HTTP-level failure", async () => {
    const client = createItunesClient(fakeFetch({}, false, 500));

    await expect(client.findPreviewByTitleAndArtist("Title", "Artist")).rejects.toThrow(
      "iTunes search failed",
    );
  });
});
