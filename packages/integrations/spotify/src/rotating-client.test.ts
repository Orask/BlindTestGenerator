import { describe, expect, it, vi } from "vitest";
import { SpotifyRateLimitedError, SpotifyRequestBudgetExceededError } from "./client.js";
import { createRotatingSpotifyClient } from "./rotating-client.js";
import type { SpotifyClient, SpotifyTrackMetadata } from "./types.js";

function fakeTrack(overrides: Partial<SpotifyTrackMetadata> = {}): SpotifyTrackMetadata {
  return {
    id: "id-1",
    title: "Dernière danse",
    artist: "Indila",
    artistNames: ["Indila"],
    albumCoverUrl: "https://example.com/cover.jpg",
    popularityRank: 0,
    ...overrides,
  };
}

/** Every method is its own standalone vi.fn(), kept as a local const by the caller — asserting on `client.method` directly trips @typescript-eslint/unbound-method. */
function fakeSpotifyClient(overrides: Partial<SpotifyClient> = {}): SpotifyClient {
  return {
    searchTracksByArtist: vi.fn().mockResolvedValue([]),
    getTrackById: vi.fn().mockResolvedValue(fakeTrack()),
    searchArtists: vi.fn().mockResolvedValue([]),
    searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(null),
    getArtistImage: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("createRotatingSpotifyClient", () => {
  it("throws when constructed with no underlying clients", () => {
    expect(() => createRotatingSpotifyClient([])).toThrow(
      "createRotatingSpotifyClient requires at least one SpotifyClient",
    );
  });

  it("delegates to the first client when it succeeds", async () => {
    const firstSearch = vi.fn().mockResolvedValue([fakeTrack()]);
    const secondSearch = vi.fn().mockResolvedValue([]);
    const first = fakeSpotifyClient({ searchTracksByArtist: firstSearch });
    const second = fakeSpotifyClient({ searchTracksByArtist: secondSearch });
    const rotating = createRotatingSpotifyClient([first, second]);

    const result = await rotating.searchTracksByArtist("Indila", 5);

    expect(result).toEqual([fakeTrack()]);
    expect(firstSearch).toHaveBeenCalledWith("Indila", 5);
    expect(secondSearch).not.toHaveBeenCalled();
  });

  it("fails over to the next client on a rate limit", async () => {
    const firstImage = vi.fn().mockRejectedValue(new SpotifyRateLimitedError(120));
    const secondImage = vi.fn().mockResolvedValue("https://example.com/artist.jpg");
    const first = fakeSpotifyClient({ getArtistImage: firstImage });
    const second = fakeSpotifyClient({ getArtistImage: secondImage });
    const rotating = createRotatingSpotifyClient([first, second]);

    const result = await rotating.getArtistImage("Indila");

    expect(result).toBe("https://example.com/artist.jpg");
    expect(secondImage).toHaveBeenCalledWith("Indila");
  });

  it("fails over to the next client when the request budget is exhausted", async () => {
    const firstArtists = vi.fn().mockRejectedValue(new SpotifyRequestBudgetExceededError(300));
    const secondArtists = vi.fn().mockResolvedValue(["Indila"]);
    const first = fakeSpotifyClient({ searchArtists: firstArtists });
    const second = fakeSpotifyClient({ searchArtists: secondArtists });
    const rotating = createRotatingSpotifyClient([first, second]);

    await expect(rotating.searchArtists("chanson francaise", 10)).resolves.toEqual(["Indila"]);
  });

  it("stays on the failed-over client for later calls instead of retrying the exhausted one", async () => {
    const firstSearch = vi.fn().mockRejectedValue(new SpotifyRateLimitedError(60));
    const secondSearch = vi.fn().mockResolvedValue([fakeTrack()]);
    const first = fakeSpotifyClient({ searchTracksByArtist: firstSearch });
    const second = fakeSpotifyClient({ searchTracksByArtist: secondSearch });
    const rotating = createRotatingSpotifyClient([first, second]);

    await rotating.searchTracksByArtist("Indila", 5);
    await rotating.searchTracksByArtist("Angèle", 5);

    expect(firstSearch).toHaveBeenCalledTimes(1);
    expect(secondSearch).toHaveBeenCalledTimes(2);
  });

  it("throws once every client is exhausted", async () => {
    const lastError = new SpotifyRateLimitedError(600);
    const first = fakeSpotifyClient({
      getTrackById: vi.fn().mockRejectedValue(new SpotifyRateLimitedError(60)),
    });
    const second = fakeSpotifyClient({ getTrackById: vi.fn().mockRejectedValue(lastError) });
    const rotating = createRotatingSpotifyClient([first, second]);

    await expect(rotating.getTrackById("id-1")).rejects.toBe(lastError);
  });

  it("does not fail over on an error unrelated to rate limiting or quota", async () => {
    const notFound = new Error('Spotify track lookup failed for id "id-1": 404 not found');
    const secondGet = vi.fn().mockResolvedValue(fakeTrack());
    const first = fakeSpotifyClient({ getTrackById: vi.fn().mockRejectedValue(notFound) });
    const second = fakeSpotifyClient({ getTrackById: secondGet });
    const rotating = createRotatingSpotifyClient([first, second]);

    await expect(rotating.getTrackById("id-1")).rejects.toBe(notFound);
    expect(secondGet).not.toHaveBeenCalled();
  });

  it("works with a single client, behaving like a passthrough", async () => {
    const only = fakeSpotifyClient({
      searchTrackByTitleAndArtist: vi.fn().mockResolvedValue(fakeTrack()),
    });
    const rotating = createRotatingSpotifyClient([only]);

    await expect(rotating.searchTrackByTitleAndArtist("Dernière danse", "Indila")).resolves.toEqual(
      fakeTrack(),
    );
  });
});
