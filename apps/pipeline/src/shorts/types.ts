// Shared shape every Short "type" selector in this directory produces —
// see docs/CLOUD_SESSION_LOG.md for why this is a handful of small,
// independent selector modules (one per Short type, matching this
// project's existing one-file-per-concern style — collect-candidates.ts,
// discover-artists.ts, collect-curated-tracks.ts, etc.) rather than a
// single generic "strategy" abstraction: the inputs each type actually
// needs (an existing episode's video id vs. a genre + no episode at all)
// differ too much to unify usefully, but the OUTPUT (what render-short.ts
// and youtube-metadata.ts need) is identical across all of them, so only
// that part is shared.
export interface ShortCandidateTrack {
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
  readonly audioUrl: string;
}
