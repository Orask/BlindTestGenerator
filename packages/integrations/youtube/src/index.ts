/**
 * Contract for the YouTube Data API v3 integration.
 * Implementation lands once OAuth credentials exist (see
 * docs/CAHIER_DES_CHARGES.md section 8).
 */
export type VideoVisibility = "private" | "unlisted" | "public";

export interface UploadVideoParams {
  readonly filePath: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly visibility: VideoVisibility;
}

export interface YoutubeClient {
  uploadVideo(params: UploadVideoParams): Promise<{ videoId: string }>;
  ensurePlaylist(title: string): Promise<{ playlistId: string }>;
  addVideoToPlaylist(videoId: string, playlistId: string): Promise<void>;
}
