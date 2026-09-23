import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./fetch-with-timeout.js";

describe("fetchWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves normally when the request completes well before the timeout", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    const result = await fetchWithTimeout(fetchImpl, "https://example.com", { headers: {} });

    expect(result).toEqual({ ok: true });
  });

  it("passes an AbortSignal through to the underlying fetch", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });

    await fetchWithTimeout(fetchImpl, "https://example.com", { headers: {} });

    const [, init] = fetchImpl.mock.calls[0] as [string, { signal: AbortSignal }];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal.aborted).toBe(false);
  });

  it("aborts the request once the timeout elapses, instead of hanging forever", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn().mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          // A request that never resolves on its own — exactly the "no
          // response, no error" stall this timeout exists to break out of.
          init.signal.addEventListener("abort", () => {
            reject(new Error("This operation was aborted"));
          });
        }),
    );

    const promise = fetchWithTimeout(fetchImpl, "https://example.com", { headers: {} });
    // Attached before advancing timers, not after — the mock rejects the
    // instant the abort fires mid-advance, and a handler attached only
    // afterwards observes it too late, which Node reports as an unhandled
    // rejection even though the test itself still passes.
    const expectation = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(20_000);

    await expectation;
  });
});
