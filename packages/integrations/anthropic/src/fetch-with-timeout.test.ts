import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./fetch-with-timeout.js";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves normally when the request completes well before the timeout", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const result = await fetchWithTimeout(fetchImpl, "https://example.com", {
      method: "POST",
      headers: {},
      body: "{}",
    });

    expect(result).toEqual({ ok: true });
  });

  it("aborts the request once the timeout elapses, instead of hanging forever", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            reject(new Error("This operation was aborted"));
          });
        }),
    );

    const promise = fetchWithTimeout(fetchImpl, "https://example.com", {
      method: "POST",
      headers: {},
      body: "{}",
    });
    const expectation = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(35_000);

    await expectation;
  });
});
