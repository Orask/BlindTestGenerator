export interface DeezerPreviewResult {
  readonly previewUrl: string;
}

export interface DeezerClient {
  findPreviewByTitleAndArtist(title: string, artist: string): Promise<DeezerPreviewResult | null>;
}
