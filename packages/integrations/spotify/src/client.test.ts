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

describe("createSpotifyClient.searchTracksByArtist", () => {
  it("maps raw Spotify tracks to SpotifyTrackMetadata", async () => {
    const client = createSpotifyClient(fakeTokenProvider(), fakeFetch([rawTrack()]));

    const results = await client.searchTracksByArtist("Indila", 10);

    expect(results).toEqual([
      {
        id: "id-1",
        title: "Dernière danse",
        artist: "Indila",
        albumCoverUrl: "https://example.com/cover.jpg",
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
        albumCoverUrl: "https://example.com/cover.jpg",
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
});
