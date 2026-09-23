// Node's global fetch has no default timeout — a stalled connection (no
// response, no error) hangs forever. See
// packages/integrations/spotify/src/fetch-with-timeout.ts for the incident
// that made this pattern standard across every external API client here.
const REQUEST_TIMEOUT_MS = 30_000;

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
