import type { CuratedSongsInput } from "./verify-curated-songs.js";

interface CuratedSongsLine {
  readonly artist: string;
  readonly songs: readonly string[];
}

function isCuratedSongsLine(value: unknown): value is CuratedSongsLine {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { artist?: unknown }).artist === "string" &&
    Array.isArray((value as { songs?: unknown }).songs) &&
    (value as { songs: unknown[] }).songs.every((song) => typeof song === "string")
  );
}

/**
 * Parses the NDJSON format the curation prompts ask an LLM for: one
 * `{"artist": "...", "songs": [...]}` object per line. NDJSON instead of a
 * single JSON object because a curation request can cover hundreds of
 * artists — long enough that a chat UI response sometimes gets cut off
 * mid-way, and a single big JSON object breaks entirely at the truncation
 * point while NDJSON just loses its last (incomplete) line, leaving every
 * artist processed before that point still usable.
 *
 * Blank lines are skipped. A line that isn't valid JSON, or doesn't match
 * the expected shape, is skipped rather than thrown on — the same
 * tolerance a truncated final line needs, applied uniformly.
 */
export function parseCuratedSongsNdjson(text: string): CuratedSongsInput {
  const result: Record<string, readonly string[]> = {};

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (isCuratedSongsLine(parsed)) {
      result[parsed.artist] = parsed.songs;
    }
  }

  return result;
}
