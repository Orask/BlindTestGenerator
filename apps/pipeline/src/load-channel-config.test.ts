import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadChannelConfig } from "./load-channel-config.js";

// The repo's actual production config, not a synthetic fixture — CI has no
// live Spotify credentials to fully dry-run the pipeline against it, but a
// schema/integrity check here at least catches a broken hand-edit (bad JSON,
// a day with no theme or two themes) before it reaches the scheduled run.
// Confirmed this gap was real: this file previously only ever tested a
// synthetic config, so several manual edits to the real one this same
// session went out with no automated check at all.
const REAL_CHANNEL_CONFIG_PATH = fileURLToPath(
  new URL("../../../channels/blindtest-fr.json", import.meta.url),
);
const ALL_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

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

describe("the real channels/blindtest-fr.json", () => {
  it("parses without error", async () => {
    await expect(loadChannelConfig(REAL_CHANNEL_CONFIG_PATH)).resolves.toBeDefined();
  });

  it("covers every weekday exactly once — resolveThemeForDay silently uses only the first match otherwise", async () => {
    const config = await loadChannelConfig(REAL_CHANNEL_CONFIG_PATH);

    for (const day of ALL_WEEKDAYS) {
      const matching = config.themes.filter((theme) => theme.day === day);
      expect(matching, `expected exactly one theme for "${day}"`).toHaveLength(1);
    }
  });

  it("has no duplicate theme ids", async () => {
    const config = await loadChannelConfig(REAL_CHANNEL_CONFIG_PATH);
    const ids = config.themes.map((theme) => theme.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate curated (title, artist) pairs within a single theme", async () => {
    const config = await loadChannelConfig(REAL_CHANNEL_CONFIG_PATH);

    for (const theme of config.themes) {
      const pairs = (theme.curatedTracks ?? []).map((track) => `${track.title}||${track.artist}`);
      expect(new Set(pairs).size, `duplicate curatedTracks entry in "${theme.id}"`).toBe(
        pairs.length,
      );
    }
  });
});
