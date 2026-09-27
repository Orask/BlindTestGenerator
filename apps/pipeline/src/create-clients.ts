import { createAnthropicClient, type AnthropicClient } from "@blindtest/anthropic";
import { createDeezerClient, type DeezerClient } from "@blindtest/deezer";
import type { ItunesClient } from "@blindtest/itunes";
import { createItunesClient } from "@blindtest/itunes";
import {
  SpotifyTokenProvider,
  createRotatingSpotifyClient,
  createSpotifyClient,
  type SpotifyClient,
} from "@blindtest/spotify";
import {
  createOAuth2Client,
  createYoutubeClient,
  YOUTUBE_LOOPBACK_REDIRECT_URI,
  type YoutubeClient,
} from "@blindtest/youtube";

export interface PipelineClients {
  readonly spotify: SpotifyClient;
  readonly itunes: ItunesClient;
  /** No env var to check — Deezer's catalog endpoints have never required authentication, unlike every other client here. */
  readonly deezer: DeezerClient;
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

// Optional extra Spotify developer apps (SPOTIFY_CLIENT_ID_2/_SECRET_2,
// _3, ...) let a run fail over to a fresh, independent quota instead of
// stalling once the primary app is rate-limited — see
// packages/integrations/spotify/src/rotating-client.ts. Only the primary
// app's cooldown carries over across runs (via spotify-cooldown.ts's DB
// row); an extra app that gets rate-limited simply starts fresh next run,
// which is an acceptable simplification since it only ever kicks in after
// the primary app already ran out.
const MAX_EXTRA_SPOTIFY_APPS = 8;

function extraSpotifyClients(fetchImpl: typeof fetch): SpotifyClient[] {
  const extras: SpotifyClient[] = [];
  for (let n = 2; n <= MAX_EXTRA_SPOTIFY_APPS + 1; n++) {
    const clientId = process.env[`SPOTIFY_CLIENT_ID_${n}`];
    const clientSecret = process.env[`SPOTIFY_CLIENT_SECRET_${n}`];
    if (!clientId || !clientSecret) {
      break;
    }
    const tokenProvider = new SpotifyTokenProvider({ clientId, clientSecret });
    extras.push(createSpotifyClient(tokenProvider, fetchImpl));
  }
  return extras;
}

export function createClientsFromEnv(options: CreateClientsOptions = {}): PipelineClients {
  const tokenProvider = new SpotifyTokenProvider({
    clientId: requireEnv("SPOTIFY_CLIENT_ID"),
    clientSecret: requireEnv("SPOTIFY_CLIENT_SECRET"),
  });
  const primarySpotify = createSpotifyClient(tokenProvider, fetch, {
    ...(options.spotifyBlockedUntil !== undefined
      ? { blockedUntil: options.spotifyBlockedUntil }
      : {}),
    ...(options.onSpotifyCooldown ? { onCooldown: options.onSpotifyCooldown } : {}),
  });
  const extraSpotify = extraSpotifyClients(fetch);
  const spotify =
    extraSpotify.length > 0
      ? createRotatingSpotifyClient([primarySpotify, ...extraSpotify])
      : primarySpotify;

  const itunes = createItunesClient();
  const deezer = createDeezerClient();

  const oauth2Client = createOAuth2Client({
    clientId: requireEnv("YOUTUBE_CLIENT_ID"),
    clientSecret: requireEnv("YOUTUBE_CLIENT_SECRET"),
    redirectUri: YOUTUBE_LOOPBACK_REDIRECT_URI,
    refreshToken: requireEnv("YOUTUBE_REFRESH_TOKEN"),
  });
  const youtube = createYoutubeClient(oauth2Client);

  const anthropicApiKey = process.env["ANTHROPIC_API_KEY"];
  const anthropic = anthropicApiKey ? createAnthropicClient(anthropicApiKey) : undefined;

  return { spotify, itunes, deezer, youtube, anthropic };
}
