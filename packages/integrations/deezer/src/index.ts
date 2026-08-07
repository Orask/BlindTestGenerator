/**
 * Contract for the Deezer integration (public API, no auth needed).
 * Implementation lands alongside the Spotify client.
 */
export interface DeezerPreviewResult {
  readonly previewUrl: string;
}

export interface DeezerClient {
  findPreviewByTitleAndArtist(title: string, artist: string): Promise<DeezerPreviewResult | null>;
}
