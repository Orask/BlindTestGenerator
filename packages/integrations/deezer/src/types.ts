export interface DeezerClient {
  /**
   * Deezer's own popularity score for a (title, artist) pair — 0 to
   * ~1,000,000, higher = more popular, comparable across different artists
   * and eras (unlike a per-search relevance rank). The closest free,
   * keyless replacement for Spotify's own `popularity` field, which
   * Spotify's February 2026 changelog removed from Track/Album/Artist
   * objects entirely (see docs/CLOUD_SESSION_LOG.md) — Deezer's API never
   * required authentication for catalog reads, so it isn't affected by
   * that lockdown at all.
   *
   * Returns null when no confident match is found — never a best-effort
   * guess, same policy as SpotifyClient.searchTrackByTitleAndArtist.
   */
  getTrackPopularityRank(title: string, artist: string): Promise<number | null>;
}
