import type { MusicBrainzClient, MusicBrainzRecording } from "./types.js";

// MusicBrainz requires a descriptive User-Agent identifying the
// application and a contact point — an unidentified or generic one risks
// outright blocking, per their API etiquette docs.
const USER_AGENT = "BlindTestGenerator/1.0 (https://github.com/Orask/BlindTestGenerator)";

// Confirmed in the official docs and by this project's own prior attempt
// (see docs/CLOUD_SESSION_LOG.md): exactly 1 request/second per
// application, strictly enforced — exceeding it risks an IP-level block,
// not just a slower response. Throttled inside the client itself rather
// than left to every caller to remember, since the consequence of
// forgetting is much worse here than for a typical rate limit.
const MIN_INTERVAL_MS = 1100;

// Below this, MusicBrainz's own fuzzy search is matching on much less
// than an exact (title, artist) pair — not confident enough to trust
// over a real discrepancy (a cover, a same-titled different song).
const MIN_CONFIDENT_SCORE = 90;

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

function normalize(value: string): string {
  return value.normalize("NFD").replace(COMBINING_DIACRITICS, "").trim().toLowerCase();
}

interface RawArtistCredit {
  readonly name: string;
}

interface RawRecording {
  readonly id: string;
  readonly title: string;
  readonly score: number;
  readonly disambiguation?: string;
  readonly ["artist-credit"]?: readonly RawArtistCredit[];
}

interface RawSearchResponse {
  readonly recordings?: readonly RawRecording[];
}

function matchesArtist(recording: RawRecording, artist: string): boolean {
  const wanted = normalize(artist);
  const credited = recording["artist-credit"] ?? [];
  return credited.some((credit) => normalize(credit.name) === wanted);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * No API key — MusicBrainz's search is open, but strictly throttled (see
 * MIN_INTERVAL_MS) and requires a real User-Agent. Verified live
 * (2026-10-22) against the production API: this project's first attempt
 * at a MusicBrainz client was blocked by the sandbox's network policy at
 * the time, not by anything MusicBrainz-side — a real query for
 * "Papaoutai" / "Stromae" returns a clean score-100 match on the first
 * try from an ordinary dev machine.
 */
export function createMusicBrainzClient(fetchImpl: typeof fetch = fetch): MusicBrainzClient {
  let lastRequestAt = 0;

  async function throttle(): Promise<void> {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < MIN_INTERVAL_MS) {
      await sleep(MIN_INTERVAL_MS - elapsed);
    }
    lastRequestAt = Date.now();
  }

  return {
    async findRecording(title: string, artist: string): Promise<MusicBrainzRecording | null> {
      await throttle();

      const query = `recording:"${title}" AND artist:"${artist}"`;
      const params = new URLSearchParams({ query, fmt: "json", limit: "5" });
      const response = await fetchImpl(
        `https://musicbrainz.org/ws/2/recording/?${params.toString()}`,
        { headers: { "User-Agent": USER_AGENT } },
      );
      if (!response.ok) {
        throw new Error(`MusicBrainz search failed for "${title}" — ${artist}: ${response.status}`);
      }

      const body = (await response.json()) as RawSearchResponse;
      const candidates = (body.recordings ?? [])
        .filter((recording) => recording.score >= MIN_CONFIDENT_SCORE)
        .filter((recording) => normalize(recording.title) === normalize(title))
        .filter((recording) => matchesArtist(recording, artist));

      const best = candidates[0];
      if (!best) {
        return null;
      }
      return {
        id: best.id,
        title: best.title,
        disambiguation: best.disambiguation ?? "",
        score: best.score,
      };
    },
  };
}
