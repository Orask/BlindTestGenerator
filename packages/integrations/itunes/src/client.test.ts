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

  it("retries after a 403 (iTunes' undocumented rate limiting) and succeeds", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 403, text: () => Promise.resolve("") })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            resultCount: 1,
            results: [
              {
                trackName: "Dernière danse",
                artistName: "Indila",
                previewUrl: "https://example.com/preview.m4a",
              },
            ],
          }),
      }) as unknown as typeof fetch;
    const client = createItunesClient(fetchImpl);

    const resultPromise = client.findPreviewByTitleAndArtist("Dernière danse", "Indila");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toEqual({ previewUrl: "https://example.com/preview.m4a" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("gives up after repeated 403s", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("blocked"),
    }) as unknown as typeof fetch;
    const client = createItunesClient(fetchImpl);

    const resultPromise = client.findPreviewByTitleAndArtist("Title", "Artist");
    const expectation = expect(resultPromise).rejects.toThrow("iTunes search failed");
    await vi.runAllTimersAsync();
    await expectation;

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    vi.useRealTimers();
  });
});
