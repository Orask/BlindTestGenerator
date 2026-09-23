import { describe, expect, it, vi } from "vitest";
import { createAnthropicClient } from "./client.js";

function fakeFetch(text: string) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ content: [{ type: "text", text }] }),
  });
}

describe("createAnthropicClient.complete", () => {
  it("returns the text block from a successful response", async () => {
    const client = createAnthropicClient("fake-key", fakeFetch('{"ok": true}'));

    const result = await client.complete({ system: "sys", prompt: "hello", maxTokens: 100 });

    expect(result).toBe('{"ok": true}');
  });

  it("sends the model, system prompt, and message in the request body", async () => {
    const fetchImpl = fakeFetch("response");
    const client = createAnthropicClient("fake-key", fetchImpl);

    await client.complete({ system: "You are helpful", prompt: "hello", maxTokens: 50 });

    const [url, init] = fetchImpl.mock.calls[0] as [string, { body: string; headers: object }];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({ "x-api-key": "fake-key" });
    const body = JSON.parse(init.body) as {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: string; content: string }[];
    };
    expect(body).toMatchObject({
      max_tokens: 50,
      system: "You are helpful",
      messages: [{ role: "user", content: "hello" }],
    });
    expect(body.model).toBeTruthy();
  });

  it("throws when the request fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("Unauthorized"),
    }) as unknown as typeof fetch;
    const client = createAnthropicClient("bad-key", fetchImpl);

    await expect(client.complete({ system: "s", prompt: "p", maxTokens: 10 })).rejects.toThrow(
      "Anthropic API request failed",
    );
  });

  it("throws when the response has no text block", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [] }),
    });
    const client = createAnthropicClient("fake-key", fetchImpl);

    await expect(client.complete({ system: "s", prompt: "p", maxTokens: 10 })).rejects.toThrow(
      "no text block",
    );
  });
});
