export interface SpotifyTrackMetadata {
  readonly id: string;
  readonly title: string;
  /** Display string — all credited artists joined with ", ". */
  readonly artist: string;
  /** The individual credited artists, for identity checks (caps, spacing) that a joined string would hide on collabs. */
  readonly artistNames: readonly string[];
  readonly albumCoverUrl: string;
  /** This artist's rank among their own search results (0 = most relevant). */
  readonly popularityRank: number;
}

export interface SpotifyClient {
  searchTracksByArtist(artistName: string, limit: number): Promise<SpotifyTrackMetadata[]>;
  /** Looks up a single already-known track by id — for re-fetching metadata (e.g. cover art) without a fresh search. */
  getTrackById(id: string): Promise<SpotifyTrackMetadata>;
  /**
   * Free-text artist search (e.g. a genre/style phrase like "rap francais"),
   * in relevance order — used to discover new candidate artists for a theme
   * whose seedArtists pool is running short. Unlike `type=track` search with
   * a `genre:` filter (tested and rejected, see
   * docs/CAHIER_DES_CHARGES.md section 3bis), `type=artist` with a plain
   * text query returns mostly real, on-topic artists even on this
   * restricted app tier — though it also surfaces the occasional
   * compilation/pseudo-artist entry, so callers must still verify each name
   * via searchTracksByArtist before trusting it.
   */
  searchArtists(query: string, limit: number, offset?: number): Promise<string[]>;
}
