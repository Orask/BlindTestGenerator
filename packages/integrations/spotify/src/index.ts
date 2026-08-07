/**
 * Contract for the Spotify integration. Implementation lands once the
 * developer app credentials exist (see docs/CAHIER_DES_CHARGES.md section 8).
 */
export interface SpotifyTrackMetadata {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
}

export interface SpotifyClient {
  searchTracksBySeed(seed: string, limit: number): Promise<SpotifyTrackMetadata[]>;
}
