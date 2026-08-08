export interface SpotifyTrackMetadata {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
  /** This artist's rank among their own search results (0 = most relevant). */
  readonly popularityRank: number;
}

export interface SpotifyClient {
  searchTracksByArtist(artistName: string, limit: number): Promise<SpotifyTrackMetadata[]>;
}
