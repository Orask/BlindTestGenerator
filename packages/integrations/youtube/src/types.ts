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
  /** Permanent — used only for a video already confirmed unwatchable (e.g. blocked worldwide by Content ID), never as a routine cleanup step. */
  deleteVideo(videoId: string): Promise<void>;
  /**
   * Number of regions `contentDetails.regionRestriction.blocked` lists for
   * each video id (0 when the video has no region restriction at all) — a
   * worldwide Content ID block shows up here as "blocked in ~every region
   * YouTube has," confirmed live at 204, vs. a handful for an ordinary
   * regional licensing gap (confirmed live at 2). The Data API exposes this
   * directly; it does NOT expose which claim/track caused it (that needs
   * Content ID/CMS partner access, see replace-blocked-tracks.ts).
   * Batched internally at the API's own limit of 50 ids per call.
   */
  getBlockedRegionCounts(videoIds: readonly string[]): Promise<Map<string, number>>;
  /**
   * Whether a video whose title contains `themeLabel` was published on the
   * channel on the same UTC calendar day as `referenceDate`, checked
   * against the channel's real uploads — not the local DB. The local-DB
   * idempotency check (hasUploadedVideoForThemeToday) only catches a
   * duplicate run if the first run's row actually made it into git;
   * confirmed live (2026-10-18): a successful local run that was never
   * committed left the DB unaware a "Rap US & International" episode
   * already existed, so the next scheduled CI run published a second
   * "Ép. 1" the same day. This checks the one source that can never be
   * out of date — the channel itself — as a second, independent guard.
   */
  hasRecentUploadForTheme(
    themeLabel: string,
    referenceDate: Date,
    maxResults?: number,
  ): Promise<boolean>;
}
