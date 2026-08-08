export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
  /**
   * This artist's rank among their own search results (0 = first/most
   * relevant) — Spotify strips the real `popularity` score for new apps
   * (see docs/CAHIER_DES_CHARGES.md section 7bis), so this search-relevance
   * order is the closest available proxy for "their best-known song."
   */
  readonly popularityRank?: number;
}
