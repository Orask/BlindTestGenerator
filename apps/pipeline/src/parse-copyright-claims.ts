// YouTube Studio's Copyright tab is rendered from untyped page state with no
// public API equivalent (confirmed this session: no CMS/partner-only
// endpoint exists for individual creators). An operator pastes the tab's
// visible text (ctrl+A / cmd+A, copy) and this turns it into the same
// (title, artist) pairs replace-blocked-tracks.ts expects — so the only
// manual step left is the copy-paste itself, not reading or transcribing it.
const WORLDWIDE_BANNER = "Vidéo bloquée dans le monde entier";
const WORLDWIDE_CLAIM_MARKER = "bloquée dans le monde entier";
const REGIONAL_CLAIM_MARKER = "bloquée dans certains territoires";

export type ClaimImpact = "none" | "regional" | "worldwide";

export interface ParsedClaim {
  readonly title: string;
  readonly artist: string;
  readonly impact: ClaimImpact;
  readonly impactText: string;
}

export interface ParsedCopyrightPage {
  /** The page's own top banner, not a re-derivation from the claims below — this is the one that actually governs playback, see the 2026-10-22 false positive where find-blocked-videos.ts's region-count heuristic flagged a video the banner itself called merely regional (5% audience, no channel impact). */
  readonly videoGloballyBlocked: boolean;
  readonly claims: readonly ParsedClaim[];
  readonly worldwideBlockingClaims: readonly ParsedClaim[];
}

/**
 * Each claim renders as a fixed 7-line run: title, artist(s), "Droits
 * d'auteur", "Audio", an impact sentence, "Afficher les détails",
 * "Intervenir" — anchoring on "Droits d'auteur" and reading 2 lines back /
 * 2 lines forward is more robust to surrounding page chrome (nav links,
 * the video's own title/duration header) than trying to delimit each
 * block from one end.
 */
export function parseCopyrightClaimsPage(rawText: string): ParsedCopyrightPage {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const videoGloballyBlocked = lines.some((line) => line.startsWith(WORLDWIDE_BANNER));

  const claims: ParsedClaim[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== "Droits d'auteur") {
      continue;
    }
    const title = lines[i - 2];
    const artist = lines[i - 1];
    const audioLine = lines[i + 1];
    const impactText = lines[i + 2];
    if (!title || !artist || audioLine !== "Audio" || !impactText) {
      continue;
    }
    const impact: ClaimImpact = impactText.includes(WORLDWIDE_CLAIM_MARKER)
      ? "worldwide"
      : impactText.includes(REGIONAL_CLAIM_MARKER)
        ? "regional"
        : "none";
    claims.push({ title, artist, impact, impactText });
  }

  return {
    videoGloballyBlocked,
    claims,
    worldwideBlockingClaims: claims.filter((claim) => claim.impact === "worldwide"),
  };
}
