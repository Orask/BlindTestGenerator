const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

export interface BlockSpec {
  readonly title: string;
  readonly artist: string;
}

export interface TrackRow {
  readonly spotify_track_id: string;
  readonly title: string;
  readonly artist: string;
}

/**
 * Resolves each human-supplied (title, artist) block spec — read off
 * YouTube Studio's Copyright tab, see replace-blocked-tracks.ts — to
 * exactly one of an episode's actual tracks_used rows. Artist matches by
 * substring (not equality) since `spec.artist` is often just one name off
 * a multi-artist credit (e.g. "Vitaa" for a row credited "Vitaa,
 * Slimane"). Title matches by either string starting with the other, not
 * equality — the claim's registered title and our stored Spotify title
 * often differ by a trailing qualifier either side doesn't have (confirmed
 * live: a claim titled "Comme Caroline" for a stored "Comme Caroline (feat.
 * MC Solaar)" row, and a claim titled "Quand même (Classic Version)" for a
 * stored plain "Quand même" row — both failed to match under exact
 * equality). Anything other than exactly one match throws rather than
 * guessing — silently blocking the wrong track, or skipping a block the
 * operator asked for, is worse than failing loudly.
 */
export function matchBlockedTrackRows(
  trackRows: readonly TrackRow[],
  blockSpecs: readonly BlockSpec[],
): TrackRow[] {
  return blockSpecs.map((spec) => {
    const normalizedSpecTitle = normalize(spec.title);
    const matches = trackRows.filter((row) => {
      const normalizedRowTitle = normalize(row.title);
      return (
        (normalizedRowTitle.startsWith(normalizedSpecTitle) ||
          normalizedSpecTitle.startsWith(normalizedRowTitle)) &&
        normalize(row.artist).includes(normalize(spec.artist))
      );
    });
    if (matches.length !== 1) {
      throw new Error(
        `${matches.length} correspondance(s) pour "${spec.title}" — ${spec.artist} (attendu : exactement 1)`,
      );
    }
    return matches[0]!;
  });
}
