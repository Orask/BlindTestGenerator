import { describe, expect, it, vi } from "vitest";
import { fetchClientCredentialsToken, SpotifyTokenProvider } from "./token-provider.js";

function fakeFetch(body: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  });
}

describe("fetchClientCredentialsToken", () => {
  it("sends Basic auth and parses the token response", async () => {
    const fetchImpl = fakeFetch({ access_token: "token-123", expires_in: 3600 });

    const result = await fetchClientCredentialsToken("id", "secret", fetchImpl);

    expect(result).toEqual({ accessToken: "token-123", expiresInSeconds: 3600 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://accounts.spotify.com/api/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("id:secret").toString("base64")}`,
        }),
      }),
    );
  });

  it("throws when the token request fails", async () => {
    const fetchImpl = fakeFetch({ error: "invalid_client" }, false);

    await expect(fetchClientCredentialsToken("id", "bad-secret", fetchImpl)).rejects.toThrow(
      "Spotify token request failed",
    );
  });
});

describe("SpotifyTokenProvider", () => {
  it("reuses a cached token while it is still valid", async () => {
    const fetchImpl = fakeFetch({ access_token: "token-1", expires_in: 3600 });
    let currentTime = 0;
    const provider = new SpotifyTokenProvider({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl,
      now: () => currentTime,
    });

    await provider.getAccessToken();
    currentTime += 10_000;
    const second = await provider.getAccessToken();

    expect(second).toBe("token-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("refreshes the token once it is close to expiry", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "token-1", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: "token-2", expires_in: 3600 }),
      }) as unknown as typeof fetch;
    let currentTime = 0;
    const provider = new SpotifyTokenProvider({
      clientId: "id",
      clientSecret: "secret",
      fetchImpl,
      now: () => currentTime,
    });

    await provider.getAccessToken();
    currentTime += 3600_000; // well past expiry
    const second = await provider.getAccessToken();

    expect(second).toBe("token-2");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
