export interface Track {
  readonly id: string;
  readonly title: string;
  /** Display string — all credited artists joined with ", ". */
  readonly artist: string;
  /**
   * The individual credited artists. A joined display string hides
   * collaborations from identity checks — "Bon Entendeur, Nicoletta" and
   * "Bernard Lavilliers, Nicoletta" read as two different "artists" even
   * though Nicoletta is on both, which let the same performer slip past the
   * per-artist cap and adjacency spacing. Anything that needs to know
   * "is this the same artist" (caps, spacing) must use this instead.
   */
  readonly artistNames: readonly string[];
  readonly albumCoverUrl: string;
  /**
   * This artist's rank among their own search results (0 = first/most
   * relevant) — Spotify strips the real `popularity` score for new apps
   * (see docs/CAHIER_DES_CHARGES.md section 7bis), so this search-relevance
   * order is the closest available proxy for "their best-known song."
   */
  readonly popularityRank?: number;
}
