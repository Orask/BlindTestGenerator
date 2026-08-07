export interface ItunesPreviewResult {
  readonly previewUrl: string;
}

export interface ItunesClient {
  findPreviewByTitleAndArtist(title: string, artist: string): Promise<ItunesPreviewResult | null>;
}
