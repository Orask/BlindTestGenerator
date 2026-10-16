import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Reads YouTube Studio's Content ID claims for one video through its
// internal (undocumented, unofficial) `list_creator_received_claims`
// endpoint — the public YouTube Data API has no equivalent; Content ID
// claim details require either CMS/partner access or a human reading
// Studio's Copyright tab (see find-blocked-videos.ts's doc comment and
// replace-blocked-tracks.ts's usage).
//
// Deliberately NOT wired into any scheduled workflow: it authenticates
// with a real Google session cookie, captured by hand from a browser's
// Network tab (DevTools → right-click the `list_creator_received_claims`
// request → Copy → Copy as cURL → take the `-b` cookie string). Session
// cookies expire and get invalidated by Google's own anomaly detection (a
// new IP per CI run is exactly the kind of signal that triggers this) —
// meant to be run interactively, by hand, re-pasting a fresh cookie string
// whenever it stops working, not as a trust-it-forever secret.
//
// The cookie is read from a FILE, not a command-line argument or inline
// env var — a session cookie string is hundreds of characters with `;`,
// `%`, `=` and other shell-special characters, which is exactly the kind
// of value that's easy to mangle pasting into a one-liner (confirmed
// live). Put it in its own file, nothing else in it.
//
// Usage:
//   1. In the browser's Network tab, copy the list_creator_received_claims
//      request as cURL, then save ONLY the part after `-b '` and before
//      the closing `'` into a text file (e.g. ~/studio-cookie.txt).
//   2. CHANNEL_ID=UC... node dist/fetch-studio-claims.js <videoId> \
//        --cookie-file ~/studio-cookie.txt [--raw]

const STUDIO_ORIGIN = "https://studio.youtube.com";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function cookieValue(cookieString: string, name: string): string {
  const match = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(cookieString);
  if (!match) {
    throw new Error(`Cookie "${name}" not found in the cookie file.`);
  }
  return match[1]!;
}

// Google's SAPISIDHASH scheme for first-party API calls from a logged-in
// web session: sha1("<unix seconds> <SAPISID-family cookie> <origin>"),
// sent as "<timestamp>_<hash>_u". Documented by reverse-engineering (no
// official spec), used identically for the SAPISID/1P/3P variants below.
function sapisidHash(cookieString: string, cookieName: string, timestamp: number): string {
  const sid = cookieValue(cookieString, cookieName);
  const hash = createHash("sha1").update(`${timestamp} ${sid} ${STUDIO_ORIGIN}`).digest("hex");
  return `${timestamp}_${hash}_u`;
}

async function postToStudio(
  videoId: string,
  channelId: string,
  cookieString: string,
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000);
  const authorization = [
    `SAPISIDHASH ${sapisidHash(cookieString, "SAPISID", timestamp)}`,
    `SAPISID1PHASH ${sapisidHash(cookieString, "__Secure-1PAPISID", timestamp)}`,
    `SAPISID3PHASH ${sapisidHash(cookieString, "__Secure-3PAPISID", timestamp)}`,
  ].join(" ");

  return fetch(`${STUDIO_ORIGIN}/youtubei/v1/creator/list_creator_received_claims?alt=json`, {
    method: "POST",
    headers: {
      accept: "*/*",
      "content-type": "application/json",
      authorization,
      origin: STUDIO_ORIGIN,
      referer: `${STUDIO_ORIGIN}/channel/${channelId}/videos/upload`,
      "x-goog-authuser": "0",
      "x-origin": STUDIO_ORIGIN,
      "x-youtube-client-name": "62",
      "x-youtube-client-version": "1.20261014.00.01",
      cookie: cookieString,
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 62,
          clientVersion: "1.20261014.00.01",
          hl: "fr",
          gl: "CH",
          utcOffsetMinutes: 60,
        },
        request: { returnLogEntry: true, internalExperimentFlags: [] },
        user: {
          delegationContext: {
            externalChannelId: channelId,
            roleType: { channelRoleType: "CREATOR_CHANNEL_ROLE_TYPE_OWNER" },
          },
        },
      },
      videoId,
      criticalRead: false,
      includeLicensingOptions: false,
      isCreatorMusicV2: true,
    }),
  });
}

export interface StudioClaim {
  readonly title: string | undefined;
  readonly claimant: string | undefined;
  readonly blockedWorldwide: boolean;
  readonly raw: unknown;
}

/**
 * Fetches the claims list for one video. Parsing is intentionally loose
 * (the response shape is unofficial and undocumented, and has already
 * changed across Studio releases before) — callers should treat `raw` as
 * the source of truth and the typed fields as best-effort. Run the CLI
 * below with --raw first if these field names ever stop matching.
 */
export async function fetchStudioClaims(
  videoId: string,
  channelId: string,
  cookieString: string,
): Promise<StudioClaim[]> {
  const response = await postToStudio(videoId, channelId, cookieString);
  if (!response.ok) {
    throw new Error(`Studio claims request failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    claims?: readonly {
      assetLabel?: string;
      claimant?: { displayName?: string };
      worldwideBlock?: boolean;
      matchDetails?: { longDescription?: string };
    }[];
  };

  return (data.claims ?? []).map((claim) => ({
    title: claim.assetLabel ?? claim.matchDetails?.longDescription,
    claimant: claim.claimant?.displayName,
    blockedWorldwide: claim.worldwideBlock === true,
    raw: claim,
  }));
}

const args = process.argv.slice(2);
const dumpRaw = args.includes("--raw");
const videoId = args.find((arg) => !arg.startsWith("--"));
const cookieFileFlagIndex = args.indexOf("--cookie-file");
const cookieFilePath = cookieFileFlagIndex !== -1 ? args[cookieFileFlagIndex + 1] : undefined;

if (!videoId || !cookieFilePath) {
  console.error(
    "Usage: CHANNEL_ID=... node fetch-studio-claims.js <videoId> --cookie-file <chemin> [--raw]",
  );
  process.exit(1);
}

const cookieString = readFileSync(cookieFilePath, "utf-8").trim();
const channelId = requireEnv("CHANNEL_ID");

if (dumpRaw) {
  const response = await postToStudio(videoId, channelId, cookieString);
  console.log("status:", response.status);
  console.log(await response.text());
  process.exit(0);
}

const claims = await fetchStudioClaims(videoId, channelId, cookieString);

console.log(`${claims.length} revendication(s) pour ${videoId} :`);
for (const claim of claims) {
  console.log(
    `  - "${claim.title ?? "?"}" — ${claim.claimant ?? "?"}` +
      (claim.blockedWorldwide ? "  ⚠️ BLOQUÉ MONDIALEMENT" : ""),
  );
}
if (claims.length === 0) {
  console.log("(aucune — soit le format de réponse a changé, soit la session a expiré)");
  console.log("Relancer avec --raw pour voir la réponse brute et ajuster le parsing.");
}
