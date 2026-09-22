import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appendDiscoveredArtists } from "./persist-discovered-artists.js";

async function writeConfig(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "channel-config-"));
  const path = join(dir, "channel.json");
  await writeFile(
    path,
    JSON.stringify({
      id: "blindtest-fr",
      themes: [
        { id: "rap-fr", seedArtists: ["Booba"] },
        { id: "annees-80", seedArtists: ["Indochine"] },
      ],
    }),
    "utf-8",
  );
  return path;
}

describe("appendDiscoveredArtists", () => {
  it("appends new artists to the matching theme's seedArtists", async () => {
    const path = await writeConfig();

    await appendDiscoveredArtists(path, "rap-fr", ["Jul", "Ninho"]);

    const config = JSON.parse(await readFile(path, "utf-8"));
    expect(config.themes[0].seedArtists).toEqual(["Booba", "Jul", "Ninho"]);
    expect(config.themes[1].seedArtists).toEqual(["Indochine"]);
  });

  it("does nothing when there are no new artists", async () => {
    const path = await writeConfig();
    const before = await readFile(path, "utf-8");

    await appendDiscoveredArtists(path, "rap-fr", []);

    expect(await readFile(path, "utf-8")).toEqual(before);
  });

  it("does nothing when the theme id isn't found", async () => {
    const path = await writeConfig();
    const before = await readFile(path, "utf-8");

    await appendDiscoveredArtists(path, "unknown-theme", ["Jul"]);

    expect(await readFile(path, "utf-8")).toEqual(before);
  });
});
