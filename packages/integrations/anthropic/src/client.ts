import { fetchWithTimeout } from "./fetch-with-timeout.js";

const ANTHROPIC_API_VERSION = "2023-06-01";

// Haiku — this client is used for structured QA/classification tasks (see
// apps/pipeline/src/review-episode.ts), not creative writing, so the
// cheapest current-generation model is the right default rather than
// something the caller has to remember to pick.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

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
          model: DEFAULT_MODEL,
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
