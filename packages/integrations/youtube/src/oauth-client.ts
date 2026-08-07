import { OAuth2Client } from "google-auth-library";

export interface YoutubeOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly refreshToken?: string;
}

export function createOAuth2Client(config: YoutubeOAuthConfig): OAuth2Client {
  const client = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  });
  if (config.refreshToken) {
    client.setCredentials({ refresh_token: config.refreshToken });
  }
  return client;
}

// Both scopes are needed: `youtube.upload` for uploading videos, `youtube`
// (full management) for creating/populating the per-theme playlists.
export const YOUTUBE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube",
] as const;

// Must match a redirect URI registered on the OAuth client in Google Cloud Console.
export const YOUTUBE_LOOPBACK_REDIRECT_PORT = 8734;
export const YOUTUBE_LOOPBACK_REDIRECT_URI = `http://127.0.0.1:${YOUTUBE_LOOPBACK_REDIRECT_PORT}/oauth2callback`;
