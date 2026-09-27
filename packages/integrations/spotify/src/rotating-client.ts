import { SpotifyRateLimitedError, SpotifyRequestBudgetExceededError } from "./client.js";
import type { SpotifyClient } from "./types.js";

function isFailoverError(error: unknown): boolean {
  return (
    error instanceof SpotifyRateLimitedError || error instanceof SpotifyRequestBudgetExceededError
  );
}

/**
 * Wraps several SpotifyClient instances — typically one per Spotify
 * developer app, each with its own client_id/client_secret — so a rate
 * limit or exhausted request budget on one app fails over to the next
 * instead of stalling (or crashing) the whole pipeline run. Spotify's
 * Client Credentials quota is per-app, so a second app's quota is genuinely
 * independent of the first's; this is what makes failover actually help
 * here, unlike retrying the same app harder (already handled inside
 * createSpotifyClient itself).
 *
 * Sticky, not round-robin: once an app starts refusing calls, every
 * subsequent call — across every method, for the rest of the process —
 * skips straight to the first non-exhausted app instead of starting over
 * from index 0, which would just re-trigger the same rate limit on every
 * single call.
 */
export function createRotatingSpotifyClient(clients: readonly SpotifyClient[]): SpotifyClient {
  if (clients.length === 0) {
    throw new Error("createRotatingSpotifyClient requires at least one SpotifyClient");
  }

  let activeIndex = 0;

  async function withFailover<T>(call: (client: SpotifyClient) => Promise<T>): Promise<T> {
    for (;;) {
      const client = clients[activeIndex] as SpotifyClient;
      try {
        return await call(client);
      } catch (error) {
        const isLastClient = activeIndex === clients.length - 1;
        if (!isFailoverError(error) || isLastClient) {
          throw error;
        }
        console.warn(
          `App Spotify #${activeIndex + 1}/${clients.length} indisponible (${(error as Error).message}), bascule sur la suivante.`,
        );
        activeIndex++;
      }
    }
  }

  return {
    searchTracksByArtist: (artistName, limit) =>
      withFailover((client) => client.searchTracksByArtist(artistName, limit)),
    getTrackById: (id) => withFailover((client) => client.getTrackById(id)),
    searchArtists: (query, limit, offset) =>
      withFailover((client) => client.searchArtists(query, limit, offset)),
    searchTrackByTitleAndArtist: (title, artistName) =>
      withFailover((client) => client.searchTrackByTitleAndArtist(title, artistName)),
    getArtistImage: (artistName) => withFailover((client) => client.getArtistImage(artistName)),
  };
}
