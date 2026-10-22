export interface MusicBrainzRecording {
  readonly id: string;
  readonly title: string;
  /**
   * Free-text clarification MusicBrainz attaches to a recording when it
   * isn't the plain studio original — e.g. "live", "DJ-mix", a compilation
   * name. Empty string when there's nothing to disambiguate. Confirmed
   * live (2026-10-22) this is populated for exactly the kind of
   * non-original pressing @blindtest/spotify's NON_ORIGINAL_VERSION_PATTERN
   * already tries to catch by regex alone — this is a second, independent
   * signal to cross-check against, not a replacement for it.
   */
  readonly disambiguation: string;
  /** MusicBrainz's own search confidence, 0-100. */
  readonly score: number;
}

export interface MusicBrainzClient {
  /**
   * Searches for a recording by (title, artist), returning the
   * highest-confidence match only when it's confident enough to trust —
   * null otherwise, never a best-effort guess (same policy as
   * SpotifyClient.searchTrackByTitleAndArtist and DeezerClient's
   * getTrackPopularityRank).
   */
  findRecording(title: string, artist: string): Promise<MusicBrainzRecording | null>;
}
