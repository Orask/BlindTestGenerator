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
}
