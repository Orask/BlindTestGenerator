import { describe, expect, it, vi } from "vitest";
import { createDeezerClient } from "./client.js";

function fakeFetch(body: unknown, ok = true, status = 200): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe("createDeezerClient.getTrackPopularityRank", () => {
  it("returns the rank of a matching track", async () => {
    const client = createDeezerClient(
      fakeFetch({
        data: [{ title: "Papaoutai", rank: 850000, artist: { name: "Stromae" } }],
      }),
    );

    const result = await client.getTrackPopularityRank("Papaoutai", "Stromae");

    expect(result).toBe(850000);
  });

  it("matches ignoring case and accents", async () => {
    const client = createDeezerClient(
      fakeFetch({
        data: [{ title: "papaoutai", rank: 850000, artist: { name: "STROMAE" } }],
      }),
    );

    const result = await client.getTrackPopularityRank("Papaoutai", "Stromae");

    expect(result).toBe(850000);
  });

  it("returns null when no track is found", async () => {
    const client = createDeezerClient(fakeFetch({ data: [] }));

    const result = await client.getTrackPopularityRank(
      "This Song Does Not Exist 12345",
      "Nobody At All",
    );

    expect(result).toBeNull();
  });

  it("skips an implausible match returned despite the field-scoped query", async () => {
    const client = createDeezerClient(
      fakeFetch({
        data: [{ title: "Something Unrelated", rank: 500000, artist: { name: "Someone Else" } }],
      }),
    );

    const result = await client.getTrackPopularityRank(
      "This Song Does Not Exist 12345",
      "Nobody At All",
    );

    expect(result).toBeNull();
  });

  it("builds a field-scoped query with quoted artist and track", async () => {
    const fetchImpl = fakeFetch({ data: [] });
    const client = createDeezerClient(fetchImpl);

    await client.getTrackPopularityRank("Dernière danse", "Indila");

    const calledUrl = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    const params = new URL(calledUrl).searchParams;
    expect(params.get("q")).toBe('artist:"Indila" track:"Dernière danse"');
    expect(params.get("order")).toBe("RANKING");
  });

  it("strips literal quotes from title/artist before building the query", async () => {
    const fetchImpl = fakeFetch({ data: [] });
    const client = createDeezerClient(fetchImpl);

    await client.getTrackPopularityRank('The "Real" Song', 'The "Real" Artist');

    const calledUrl = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    const params = new URL(calledUrl).searchParams;
    expect(params.get("q")).toBe('artist:"The Real Artist" track:"The Real Song"');
  });

  it("throws on an HTTP-level failure", async () => {
    const client = createDeezerClient(fakeFetch({}, false, 500));

    await expect(client.getTrackPopularityRank("Title", "Artist")).rejects.toThrow(
      "Deezer search failed",
    );
  });

  it("throws when Deezer returns a 200 with an error body (e.g. quota exceeded)", async () => {
    const client = createDeezerClient(
      fakeFetch({ error: { message: "Quota limit exceeded", type: "QuotaException", code: 4 } }),
    );

    await expect(client.getTrackPopularityRank("Title", "Artist")).rejects.toThrow(
      "Quota limit exceeded",
    );
  });
});
