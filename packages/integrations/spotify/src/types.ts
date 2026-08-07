export interface SpotifyTrackMetadata {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
}

export interface SpotifyClient {
  searchTracksByArtist(artistName: string, limit: number): Promise<SpotifyTrackMetadata[]>;
}
