export type VideoVisibility = "private" | "unlisted" | "public";

export interface UploadVideoParams {
  readonly filePath: string;
  readonly title: string;
  readonly description: string;
  readonly tags: readonly string[];
  readonly visibility: VideoVisibility;
  /**
   * Schedules the video to go public at this time instead of publishing
   * immediately. YouTube requires the video to be uploaded as "private" for
   * this to work — the client forces that regardless of `visibility` when
   * `publishAt` is set, and YouTube auto-flips it to public at that time.
   */
  readonly publishAt?: Date;
}

export interface YoutubeClient {
  uploadVideo(params: UploadVideoParams): Promise<{ videoId: string }>;
  setThumbnail(videoId: string, filePath: string): Promise<void>;
  ensurePlaylist(title: string): Promise<{ playlistId: string }>;
  addVideoToPlaylist(videoId: string, playlistId: string): Promise<void>;
}
