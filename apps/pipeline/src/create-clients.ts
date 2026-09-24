import { createAnthropicClient, type AnthropicClient } from "@blindtest/anthropic";
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
  /** Undefined when ANTHROPIC_API_KEY isn't set — the AI episode review is an optional quality upgrade, never a requirement to publish. */
  readonly anthropic: AnthropicClient | undefined;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export interface CreateClientsOptions {
  /** Spotify cooldown left over from a previous run (epoch ms) — see spotify-cooldown.ts. */
  readonly spotifyBlockedUntil?: number | undefined;
  /** Persists a newly detected Spotify cooldown for the next run. */
  readonly onSpotifyCooldown?: ((blockedUntil: number) => void) | undefined;
}

export function createClientsFromEnv(options: CreateClientsOptions = {}): PipelineClients {
  const tokenProvider = new SpotifyTokenProvider({
    clientId: requireEnv("SPOTIFY_CLIENT_ID"),
    clientSecret: requireEnv("SPOTIFY_CLIENT_SECRET"),
  });
  const spotify = createSpotifyClient(tokenProvider, fetch, {
    ...(options.spotifyBlockedUntil !== undefined
      ? { blockedUntil: options.spotifyBlockedUntil }
      : {}),
    ...(options.onSpotifyCooldown ? { onCooldown: options.onSpotifyCooldown } : {}),
  });

  const itunes = createItunesClient();

  const oauth2Client = createOAuth2Client({
    clientId: requireEnv("YOUTUBE_CLIENT_ID"),
    clientSecret: requireEnv("YOUTUBE_CLIENT_SECRET"),
    redirectUri: YOUTUBE_LOOPBACK_REDIRECT_URI,
    refreshToken: requireEnv("YOUTUBE_REFRESH_TOKEN"),
  });
  const youtube = createYoutubeClient(oauth2Client);

  const anthropicApiKey = process.env["ANTHROPIC_API_KEY"];
  const anthropic = anthropicApiKey ? createAnthropicClient(anthropicApiKey) : undefined;

  return { spotify, itunes, youtube, anthropic };
}
