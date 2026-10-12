import { fetchWithTimeout } from "./fetch-with-timeout.js";

const ANTHROPIC_API_VERSION = "2023-06-01";

// Sonnet — this client's one call site (apps/pipeline/src/review-episode.ts)
// makes nuanced judgment calls (is this track actually the wrong era/genre
// for the theme, confirmed live to matter: 2026-10-12 YouTube comments
// flagged exactly this), not simple structured classification, and real
// usage is a fraction of a cent/day against a $20 budget — the quality
// upgrade from Haiku is essentially free here. Overridable per client for a
// future call site that genuinely only needs cheap classification.
const DEFAULT_MODEL = "claude-sonnet-5";

export interface AnthropicCompleteParams {
  readonly system: string;
  readonly prompt: string;
  readonly maxTokens: number;
}

export interface AnthropicClient {
  complete(params: AnthropicCompleteParams): Promise<string>;
}

interface AnthropicResponse {
  readonly content: readonly { readonly type: string; readonly text?: string }[];
}

export function createAnthropicClient(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  model: string = DEFAULT_MODEL,
): AnthropicClient {
  return {
    async complete({ system, prompt, maxTokens }: AnthropicCompleteParams): Promise<string> {
      const response = await fetchWithTimeout(fetchImpl, "https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Anthropic API request failed: ${response.status} ${await response.text()}`,
        );
      }

      const data = (await response.json()) as AnthropicResponse;
      const text = data.content.find((block) => block.type === "text")?.text;
      if (text === undefined) {
        throw new Error("Anthropic API response contained no text block");
      }
      return text;
    },
  };
}
