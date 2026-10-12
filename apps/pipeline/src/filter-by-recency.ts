import type { ChannelTheme, Track } from "@blindtest/core";

// Spotify release dates come in three precisions depending on the
// release's own metadata ("1986", "1986-03", "1986-03-14") — only the
// leading 4 digits are ever needed here.
function releaseYear(releaseDate: string): number | undefined {
  const match = /^\d{4}/.exec(releaseDate);
  return match ? Number(match[0]) : undefined;
}

/**
 * Applies a theme's releaseYearRange or recencyWindowYears (see
 * channel-config.ts's doc comments — at most one is ever set per theme)
 * to a candidate pool, before it reaches buildEpisodeTracks. Deliberately
 * never applied to curatedTracks at the call site (see pipeline.ts) —
 * those are specific, trusted picks, not a bulk search result that needs
 * an era/recency sanity check.
 *
 * A candidate with no parseable release year is kept, not dropped —
 * missing data is treated as "unknown, not disqualifying" rather than a
 * silent false rejection.
 */
export function filterByRecency(
  candidates: readonly Track[],
  theme: ChannelTheme,
  now: Date = new Date(),
): Track[] {
  if (theme.releaseYearRange) {
    const { min, max } = theme.releaseYearRange;
    return candidates.filter((track) => {
      const year = track.releaseDate ? releaseYear(track.releaseDate) : undefined;
      if (year === undefined) {
        return true;
      }
      if (min !== undefined && year < min) {
        return false;
      }
      if (max !== undefined && year > max) {
        return false;
      }
      return true;
    });
  }

  if (theme.recencyWindowYears !== undefined) {
    const cutoffYear = now.getUTCFullYear() - theme.recencyWindowYears;
    return candidates.filter((track) => {
      const year = track.releaseDate ? releaseYear(track.releaseDate) : undefined;
      return year === undefined || year >= cutoffYear;
    });
  }

  return candidates.slice();
}
