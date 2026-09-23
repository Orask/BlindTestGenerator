import { describe, expect, it, vi } from "vitest";
import { createSpotifyClient, type TokenProvider } from "./client.js";

interface RawSpotifyTrackFixture {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}

function fakeTokenProvider(): TokenProvider {
  return { getAccessToken: vi.fn().mockResolvedValue("fake-token") };
}

function rawTrack(overrides: Partial<RawSpotifyTrackFixture> = {}): RawSpotifyTrackFixture {
  return {
    id: "id-1",
    name: "Dernière danse",
    artists: [{ name: "Indila" }],
    album: { images: [{ url: "https://example.com/cover.jpg" }] },
    ...overrides,
  };
}

function fakeFetch(tracks: RawSpotifyTrackFixture[]): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ tracks: { items: tracks } }),
  });
}

function fakeRateLimitedResponse(retryAfterSeconds = "0"): {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
} {
  return {
    ok: false,
    status: 429,
    headers: { get: () => retryAfterSeconds },
    text: () => Promise.resolve('{"error":{"status":429,"message":"Too many requests"}}'),
  };
}

describe("createSpotifyClient rate-limit retry (shared by every endpoint)", () => {
  // Exercised through searchTracksByArtist since fetchWithRetry isn't
  // exported on its own — the retry behavior is identical for every method.
  it("retries after a 429 and succeeds once Spotify stops rate-limiting", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(fakeRateLimitedResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ tracks: { items: [rawTrack()] } }),
      });
    const client = createSpotifyClient(fakeTokenProvider(), fetchImpl);

    const results = await client.searchTracksByArtist("Indila", 10);

    expect(results).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up and surfaces the 429 once retries are exhausted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(fakeRateLimitedResponse());
    const client = createSpotifyClient(fakeTokenProvider(), fetchImpl);

    await expect(client.searchTracksByArtist("Indila", 10)).rejects.toThrow(
      "Spotify search failed",
    );
  });
});

describe("createSpotifyClient.searchTracksByArtist", () => {
  it("maps raw Spotify tracks to SpotifyTrackMetadata", async () => {
    const client = createSpotifyClient(fakeTokenProvider(), fakeFetch([rawTrack()]));

    const results = await client.searchTracksByArtist("Indila", 10);

    expect(results).toEqual([
      {
        id: "id-1",
        title: "Dernière danse",
        artist: "Indila",
        artistNames: ["Indila"],
        albumCoverUrl: "https://example.com/cover.jpg",
        popularityRank: 0,
      },
    ]);
  });

  it("filters out remixes, live takes and other non-original versions", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([
        rawTrack({ id: "1", name: "Dernière danse" }),
        rawTrack({ id: "2", name: "Dernière danse - Live" }),
        rawTrack({ id: "3", name: "Dernière danse (Remix)" }),
        rawTrack({ id: "4", name: "Dernière danse - Instrumental" }),
      ]),
    );

    const results = await client.searchTracksByArtist("Indila", 10);

    expect(results).toEqual([
      {
        id: "1",
        title: "Dernière danse",
        artist: "Indila",
        artistNames: ["Indila"],
        albumCoverUrl: "https://example.com/cover.jpg",
        popularityRank: 0,
      },
    ]);
  });

  it("de-duplicates tracks with the same title from different releases", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([
        rawTrack({ id: "1", name: "Dernière danse" }),
        rawTrack({ id: "2", name: "dernière danse" }),
      ]),
    );

    const results = await client.searchTracksByArtist("Indila", 10);

    expect(results).toHaveLength(1);
  });

  it("stops once the requested limit is reached", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([
        rawTrack({ id: "1", name: "Track A" }),
        rawTrack({ id: "2", name: "Track B" }),
        rawTrack({ id: "3", name: "Track C" }),
      ]),
    );

    const results = await client.searchTracksByArtist("Indila", 2);

    expect(results).toHaveLength(2);
  });

  it("throws when the search request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve("Forbidden"),
    }) as unknown as typeof fetch;
    const client = createSpotifyClient(fakeTokenProvider(), fetchImpl);

    await expect(client.searchTracksByArtist("Indila", 10)).rejects.toThrow(
      "Spotify search failed",
    );
  });

  it("discards tracks that don't actually credit the searched artist (Spotify's fuzzy match)", async () => {
    // Reproduces a real, confirmed case: searching "Dorothée" returns tracks
    // credited only to "Dorothée Pousséo" (an unrelated modern voice
    // actress) because Spotify's artist filter is a loose text match, not
    // an exact one.
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([
        rawTrack({ id: "1", name: "Bizarre bizarre", artists: [{ name: "Dorothée Pousséo" }] }),
        rawTrack({ id: "2", name: "Do Do L'enfant Do", artists: [{ name: "Dorothée" }] }),
        rawTrack({
          id: "3",
          name: "Featuring",
          artists: [{ name: "Someone Else" }, { name: "Dorothée" }],
        }),
      ]),
    );

    const results = await client.searchTracksByArtist("Dorothée", 10);

    expect(results.map((r) => r.id)).toEqual(["2", "3"]);
  });

  it("matches the searched artist regardless of case or diacritics", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([rawTrack({ id: "1", artists: [{ name: "Stromae" }] })]),
    );

    const results = await client.searchTracksByArtist("STROMAÉ", 10);

    expect(results).toHaveLength(1);
  });
});

describe("createSpotifyClient.searchArtists", () => {
  function fakeArtistFetch(names: string[]): typeof fetch {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ artists: { items: names.map((name) => ({ name })) } }),
    });
  }

  it("returns artist names in relevance order", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeArtistFetch(["Jul", "Ninho", "Niska"]),
    );

    const results = await client.searchArtists("rap francais", 10);

    expect(results).toEqual(["Jul", "Ninho", "Niska"]);
  });

  it("passes the offset through for pagination", async () => {
    const fetchImpl = fakeArtistFetch(["Soprano"]);
    const client = createSpotifyClient(fakeTokenProvider(), fetchImpl);

    await client.searchArtists("rap francais", 10, 10);

    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining("offset=10"), expect.anything());
  });

  it("throws when the search request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request"),
    }) as unknown as typeof fetch;
    const client = createSpotifyClient(fakeTokenProvider(), fetchImpl);

    await expect(client.searchArtists("rap francais", 10)).rejects.toThrow(
      "Spotify artist search failed",
    );
  });
});

describe("createSpotifyClient.searchTrackByTitleAndArtist", () => {
  it("returns the track when title and artist both match exactly", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([rawTrack({ id: "1", name: "Dernière danse", artists: [{ name: "Indila" }] })]),
    );

    const result = await client.searchTrackByTitleAndArtist("Dernière danse", "Indila");

    expect(result).toEqual({
      id: "1",
      title: "Dernière danse",
      artist: "Indila",
      artistNames: ["Indila"],
      albumCoverUrl: "https://example.com/cover.jpg",
      popularityRank: 0,
    });
  });

  it("matches title and artist regardless of case or diacritics", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([rawTrack({ id: "1", name: "Dernière danse", artists: [{ name: "Indila" }] })]),
    );

    const result = await client.searchTrackByTitleAndArtist("derniere DANSE", "indila");

    expect(result?.id).toBe("1");
  });

  it("returns null when the title doesn't match (a possible LLM hallucination)", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([rawTrack({ id: "1", name: "Dernière danse", artists: [{ name: "Indila" }] })]),
    );

    const result = await client.searchTrackByTitleAndArtist("Chanson Imaginaire", "Indila");

    expect(result).toBeNull();
  });

  it("returns null when the artist doesn't actually match (Spotify's fuzzy filter)", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([
        rawTrack({ id: "1", name: "Dernière danse", artists: [{ name: "Someone Else" }] }),
      ]),
    );

    const result = await client.searchTrackByTitleAndArtist("Dernière danse", "Indila");

    expect(result).toBeNull();
  });

  it("skips a non-original version and keeps looking", async () => {
    const client = createSpotifyClient(
      fakeTokenProvider(),
      fakeFetch([
        rawTrack({ id: "1", name: "Dernière danse - Live", artists: [{ name: "Indila" }] }),
        rawTrack({ id: "2", name: "Dernière danse", artists: [{ name: "Indila" }] }),
      ]),
    );

    const result = await client.searchTrackByTitleAndArtist("Dernière danse", "Indila");

    expect(result?.id).toBe("2");
  });

  it("throws when the search request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request"),
    }) as unknown as typeof fetch;
    const client = createSpotifyClient(fakeTokenProvider(), fetchImpl);

    await expect(client.searchTrackByTitleAndArtist("Dernière danse", "Indila")).rejects.toThrow(
      "Spotify title+artist search failed",
    );
  });
});

describe("createSpotifyClient.getTrackById", () => {
  it("fetches a single track by id and maps it to SpotifyTrackMetadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(rawTrack({ id: "abc", artists: [{ name: "Indila" }] })),
    });
    const client = createSpotifyClient(fakeTokenProvider(), fetchImpl);

    const result = await client.getTrackById("abc");

    expect(result).toEqual({
      id: "abc",
      title: "Dernière danse",
      artist: "Indila",
      artistNames: ["Indila"],
      albumCoverUrl: "https://example.com/cover.jpg",
      popularityRank: 0,
    });
  });

  it("throws when the lookup fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not Found"),
    }) as unknown as typeof fetch;
    const client = createSpotifyClient(fakeTokenProvider(), fetchImpl);

    await expect(client.getTrackById("missing")).rejects.toThrow("Spotify track lookup failed");
  });
});
