export interface AccessToken {
  readonly accessToken: string;
  readonly expiresInSeconds: number;
}

export async function fetchClientCredentialsToken(
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessToken> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetchImpl("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in };
}

export interface SpotifyTokenProviderParams {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
}

/** Caches the Client Credentials token in memory and refreshes it shortly before it expires. */
export class SpotifyTokenProvider {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private cached: { accessToken: string; expiresAt: number } | undefined;

  constructor(params: SpotifyTokenProviderParams) {
    this.clientId = params.clientId;
    this.clientSecret = params.clientSecret;
    this.fetchImpl = params.fetchImpl ?? fetch;
    this.now = params.now ?? Date.now;
  }

  async getAccessToken(): Promise<string> {
    const currentTime = this.now();
    if (this.cached && this.cached.expiresAt > currentTime) {
      return this.cached.accessToken;
    }

    const { accessToken, expiresInSeconds } = await fetchClientCredentialsToken(
      this.clientId,
      this.clientSecret,
      this.fetchImpl,
    );
    // Refresh 60s early so a token never expires mid-request.
    this.cached = { accessToken, expiresAt: currentTime + (expiresInSeconds - 60) * 1000 };
    return accessToken;
  }
}
