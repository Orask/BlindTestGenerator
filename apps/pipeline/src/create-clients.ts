import type { ItunesClient } from "@blindtest/itunes";
import { createItunesClient } from "@blindtest/itunes";
import { SpotifyTokenProvider, createSpotifyClient, type SpotifyClient } from "@blindtest/spotify";
import {
  createOAuth2Client,
  createYoutubeClient,
  YOUTUBE_LOOPBACK_REDIRECT_URI,
  type YoutubeClient,
} from "@blindtest/youtube";

export interface PipelineClients {
  readonly spotify: SpotifyClient;
  readonly itunes: ItunesClient;
  readonly youtube: YoutubeClient;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createClientsFromEnv(): PipelineClients {
  const tokenProvider = new SpotifyTokenProvider({
    clientId: requireEnv("SPOTIFY_CLIENT_ID"),
    clientSecret: requireEnv("SPOTIFY_CLIENT_SECRET"),
  });
  const spotify = createSpotifyClient(tokenProvider);

  const itunes = createItunesClient();

  const oauth2Client = createOAuth2Client({
    clientId: requireEnv("YOUTUBE_CLIENT_ID"),
    clientSecret: requireEnv("YOUTUBE_CLIENT_SECRET"),
    redirectUri: YOUTUBE_LOOPBACK_REDIRECT_URI,
    refreshToken: requireEnv("YOUTUBE_REFRESH_TOKEN"),
  });
  const youtube = createYoutubeClient(oauth2Client);

  return { spotify, itunes, youtube };
}
