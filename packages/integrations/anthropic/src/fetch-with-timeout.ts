// Node's global fetch has no default timeout — a stalled connection (no
// response, no error) hangs forever. See
// packages/integrations/spotify/src/fetch-with-timeout.ts for the incident
// that made this pattern standard across every external API client here.
//
// 30s (this client's original value) was tuned for Haiku; confirmed live
// (2026-10-21, Anthropic console: req_011CgEikVfJFHbexAEUjS5Qw) that a real
// Sonnet review call completed generating all 3199 output tokens at
// 29.483s — our own AbortController fired first, so the finished response
// was thrown away as a client-side 499 right before delivery (billed for
// nothing, and review-episode.ts's fail-open path silently skipped the
// quality upgrade instead of erroring). Sonnet is slower by design here
// (see DEFAULT_MODEL's comment in client.ts) — 90s gives real calls room
// to actually finish instead of racing the deadline.
const REQUEST_TIMEOUT_MS = 90_000;

export interface AnthropicFetchInit {
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: string;
}

export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: AnthropicFetchInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
