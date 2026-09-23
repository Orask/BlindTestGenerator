import type { AnthropicClient } from "@blindtest/anthropic";
import type { RecentTrack } from "@blindtest/db";
import type { EpisodeTrack } from "./build-episode-tracks.js";

export interface ReviewEpisodeInput {
  readonly themeLabel: string;
  readonly tracks: readonly EpisodeTrack[];
  readonly recentTracks: readonly RecentTrack[];
}

export interface ReviewEpisodeResult {
  readonly tracks: readonly EpisodeTrack[];
  readonly removed: readonly EpisodeTrack[];
  readonly notes: string | undefined;
}

// However confident the review sounds, it never gets to gut the episode —
// this bounds the damage a hallucinated or overzealous response can do. A
// review that wants to remove more than this is treated as untrustworthy
// (see parseReviewResponse) rather than partially honored.
const MAX_REMOVE_RATIO = 0.2;

const SYSTEM_PROMPT =
  "Tu es un contrôleur qualité pour une chaîne YouTube de blind test musical français. " +
  "Tu examines la liste des morceaux d'un épisode avant sa mise en ligne.";

function buildPrompt(input: ReviewEpisodeInput): string {
  const trackLines = input.tracks
    .map((track, index) => `${index + 1}. "${track.title}" — ${track.artist}`)
    .join("\n");
  const recentLines =
    input.recentTracks.length > 0
      ? input.recentTracks.map((track) => `- "${track.title}" — ${track.artist}`).join("\n")
      : "(aucun historique récent)";

  return `Thème de l'épisode : "${input.themeLabel}"

Liste des ${input.tracks.length} morceaux sélectionnés pour cet épisode (dans l'ordre actuel) :
${trackLines}

Morceaux utilisés dans les épisodes de ce thème ces dernières semaines (pour éviter de sur-utiliser les mêmes artistes) :
${recentLines}

Ta tâche :
1. Identifie les morceaux qui NE correspondent PAS vraiment au thème (mauvaise époque, mauvais genre, erreur d'attribution d'artiste — ex : un morceau récent glissé par erreur dans un thème d'une décennie passée, ou un homonyme d'un artiste différent).
2. Identifie les morceaux d'artistes trop peu connus du grand public français pour ouvrir l'épisode.
3. Suggère un ordre où les morceaux les plus reconnaissables/populaires arrivent en premier, pour capter l'attention dès le début.
4. Si un artiste revient déjà beaucoup dans l'historique récent ci-dessus, tu peux le signaler dans tes notes, mais ne retire pas systématiquement pour autant — la diversité est un plus, pas une règle stricte.

Ne retire un morceau que si tu es vraiment confiant qu'il pose un problème réel — retirer à tort réduit la durée de l'épisode. Réponds UNIQUEMENT avec un JSON valide (rien avant, rien après, pas de \`\`\`json\`\`\` autour), exactement dans ce format :

{
  "remove": [numéros des morceaux à retirer, ex: [12, 45]],
  "order": [TOUS les numéros restants (ceux non retirés), dans l'ordre suggéré],
  "notes": "brève explication en une phrase des retraits, ou chaîne vide si aucun"
}`;
}

interface RawReviewResponse {
  readonly remove?: unknown;
  readonly order?: unknown;
  readonly notes?: unknown;
}

function isValidTrackNumber(value: unknown, total: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= total;
}

/**
 * Never trusts the response blindly: strips a possible markdown fence,
 * requires `remove` and `order` to together account for every track exactly
 * once (no duplicates, nothing missing, nothing out of range), and caps how
 * much can be removed (MAX_REMOVE_RATIO). Returns null on any violation —
 * the caller falls back to the original, unreviewed track list rather than
 * acting on a malformed or over-aggressive response.
 */
function parseReviewResponse(
  raw: string,
  tracks: readonly EpisodeTrack[],
): ReviewEpisodeResult | null {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");

  let parsed: RawReviewResponse;
  try {
    parsed = JSON.parse(cleaned) as RawReviewResponse;
  } catch {
    return null;
  }

  const total = tracks.length;
  const removeNumbers = Array.isArray(parsed.remove)
    ? parsed.remove.filter((value): value is number => isValidTrackNumber(value, total))
    : [];
  const orderNumbers = Array.isArray(parsed.order)
    ? parsed.order.filter((value): value is number => isValidTrackNumber(value, total))
    : [];

  if (removeNumbers.length !== new Set(removeNumbers).size) {
    return null;
  }
  if (orderNumbers.length !== new Set(orderNumbers).size) {
    return null;
  }
  const removeSet = new Set(removeNumbers);
  const orderSet = new Set(orderNumbers);
  if (removeSet.size + orderSet.size !== total) {
    return null;
  }
  for (let n = 1; n <= total; n++) {
    if (removeSet.has(n) === orderSet.has(n)) {
      return null;
    }
  }
  if (removeSet.size > total * MAX_REMOVE_RATIO) {
    return null;
  }

  return {
    tracks: orderNumbers.map((n) => tracks[n - 1]!),
    removed: removeNumbers.map((n) => tracks[n - 1]!),
    notes: typeof parsed.notes === "string" && parsed.notes.length > 0 ? parsed.notes : undefined,
  };
}

/**
 * Last line of defense before rendering: an LLM reads the actual track
 * list (unlike the selection pipeline, which only ever checks artist names
 * and Spotify search rank) and can catch things those checks structurally
 * can't — a track that's thematically wrong, a name collision that slipped
 * past exact-match verification, or a weak opening lineup.
 *
 * Deliberately fails open: any error (network, malformed response,
 * suspicious removal count) returns the original, untouched track list
 * rather than risking a broken or truncated episode over a review-layer
 * problem. This step is a quality upgrade, never a publishing gate.
 */
export async function reviewEpisode(
  anthropic: AnthropicClient,
  input: ReviewEpisodeInput,
): Promise<ReviewEpisodeResult> {
  const fallback: ReviewEpisodeResult = { tracks: input.tracks, removed: [], notes: undefined };

  let raw: string;
  try {
    raw = await anthropic.complete({
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      maxTokens: 4000,
    });
  } catch {
    return fallback;
  }

  return parseReviewResponse(raw, input.tracks) ?? fallback;
}
