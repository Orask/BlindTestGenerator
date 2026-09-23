import type { SpotifyClient } from "@blindtest/spotify";

/** Raw shape an LLM curation prompt is asked to produce: artist name -> list of song titles. */
export interface CuratedSongsInput {
  readonly [artist: string]: readonly string[];
}

export interface VerifiedCuratedSong {
  readonly artist: string;
  readonly title: string;
  readonly spotifyTrackId: string;
}

export interface RejectedCuratedSong {
  readonly artist: string;
  readonly title: string;
  /** Set when the lookup itself failed (e.g. rate limit exhausted after retries) rather than Spotify cleanly returning no match. */
  readonly error?: string;
}

export interface VerifyCuratedSongsResult {
  readonly verified: readonly VerifiedCuratedSong[];
  readonly rejected: readonly RejectedCuratedSong[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type CuratedSongsProgressEvent = VerifyCuratedSongsResult & {
  readonly done: number;
  readonly total: number;
  /** The song just processed this call, and which list it landed in — so a caller doesn't have to infer it from array lengths. */
  readonly last: VerifiedCuratedSong | RejectedCuratedSong;
  readonly lastOutcome: "verified" | "rejected";
};

export type CuratedSongsProgress = (progress: CuratedSongsProgressEvent) => void | Promise<void>;

/**
 * Checks every (artist, title) pair an LLM curation prompt returned against
 * Spotify's real catalog (see SpotifyClient.searchTrackByTitleAndArtist) —
 * an LLM can misremember a title, attribute a song to the wrong artist, or
 * invent one outright, so nothing here is trusted until Spotify confirms an
 * exact match. Anything that doesn't match exactly is rejected rather than
 * fuzzy-matched, same policy as every other artist/title check in this repo.
 *
 * `onProgress` is awaited before moving to the next song — a caller that
 * uses it to checkpoint progress to disk (see curate-songs-cli.ts, since a
 * full run can be hundreds of calls and take many minutes) needs each
 * checkpoint to reflect a consistent, fully-settled state.
 */
export async function verifyCuratedSongs(
  spotify: SpotifyClient,
  input: CuratedSongsInput,
  lookupDelayMs = 350,
  onProgress?: CuratedSongsProgress,
): Promise<VerifyCuratedSongsResult> {
  const verified: VerifiedCuratedSong[] = [];
  const rejected: RejectedCuratedSong[] = [];
  const total = Object.values(input).reduce((sum, titles) => sum + titles.length, 0);
  let done = 0;

  for (const [artist, titles] of Object.entries(input)) {
    for (const title of titles) {
      let last: VerifiedCuratedSong | RejectedCuratedSong;
      let lastOutcome: "verified" | "rejected";
      try {
        const match = await spotify.searchTrackByTitleAndArtist(title, artist);
        if (match) {
          last = { artist, title: match.title, spotifyTrackId: match.id };
          lastOutcome = "verified";
          verified.push(last);
        } else {
          last = { artist, title };
          lastOutcome = "rejected";
          rejected.push(last);
        }
      } catch (error) {
        // A single persistent failure (e.g. a rate limit that outlasts the
        // client's own retries — see fetchWithRetry) must never abort a run
        // that's already verified hundreds of songs; it's recorded and
        // skipped instead, ending up back in the LLM re-curation loop later.
        last = { artist, title, error: error instanceof Error ? error.message : String(error) };
        lastOutcome = "rejected";
        rejected.push(last);
      }
      done++;
      await onProgress?.({ verified, rejected, done, total, last, lastOutcome });
      await sleep(lookupDelayMs);
    }
  }

  return { verified, rejected };
}
