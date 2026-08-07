import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadChannelConfig } from "./load-channel-config.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "blindtest-config-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadChannelConfig", () => {
  it("parses a valid channel config file", async () => {
    const path = join(dir, "channel.json");
    await writeFile(
      path,
      JSON.stringify({
        id: "blindtest-fr",
        name: "BlindTest FR",
        language: "fr",
        visibility: "private",
        themes: [
          {
            day: "monday",
            id: "annees-80",
            label: "Années 80",
            seedArtists: ["Jean-Jacques Goldman"],
            youtubePlaylistId: null,
          },
        ],
      }),
    );

    const config = await loadChannelConfig(path);

    expect(config.id).toBe("blindtest-fr");
    expect(config.themes).toHaveLength(1);
  });

  it("rejects a file that does not match the channel config schema", async () => {
    const path = join(dir, "channel.json");
    await writeFile(path, JSON.stringify({ id: "blindtest-fr" }));

    await expect(loadChannelConfig(path)).rejects.toThrow();
  });
});
