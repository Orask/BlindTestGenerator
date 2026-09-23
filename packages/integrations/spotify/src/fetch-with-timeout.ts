// Node's global fetch has no default timeout — a stalled connection (no
// response, no error) hangs forever. Confirmed live on a long verification
// run: a plain `node ...` process sitting at 0% CPU and 0 network bytes for
// over an hour with no progress and no crash. Aborting after this long and
// letting the failure surface (or be retried, see client.ts's
// fetchWithRetry) is what turns "hangs forever" into "fails loudly".
const REQUEST_TIMEOUT_MS = 15_000;

export interface SpotifyFetchInit {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

export async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  init: SpotifyFetchInit,
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
