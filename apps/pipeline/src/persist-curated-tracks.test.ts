import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appendCuratedTracks } from "./persist-curated-tracks.js";

async function writeConfig(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "channel-config-"));
  const path = join(dir, "channel.json");
  await writeFile(
    path,
    JSON.stringify({
      id: "blindtest-fr",
      themes: [
        { id: "rap-fr", curatedTracks: [{ title: "Tonton du bled", artist: "113" }] },
        { id: "annees-80", seedArtists: ["Indochine"] },
      ],
    }),
    "utf-8",
  );
  return path;
}

describe("appendCuratedTracks", () => {
  it("appends new curated tracks to the matching theme's curatedTracks", async () => {
    const path = await writeConfig();

    await appendCuratedTracks(path, "rap-fr", [{ title: "Avant toi", artist: "Vitaa" }]);

    const config = JSON.parse(await readFile(path, "utf-8"));
    expect(config.themes[0].curatedTracks).toEqual([
      { title: "Tonton du bled", artist: "113" },
      { title: "Avant toi", artist: "Vitaa" },
    ]);
  });

  it("creates curatedTracks when the theme doesn't have one yet", async () => {
    const path = await writeConfig();

    await appendCuratedTracks(path, "annees-80", [
      { title: "Marcia Baila", artist: "Les Rita Mitsouko" },
    ]);

    const config = JSON.parse(await readFile(path, "utf-8"));
    expect(config.themes[1].curatedTracks).toEqual([
      { title: "Marcia Baila", artist: "Les Rita Mitsouko" },
    ]);
  });

  it("does nothing when there are no new tracks", async () => {
    const path = await writeConfig();
    const before = await readFile(path, "utf-8");

    await appendCuratedTracks(path, "rap-fr", []);

    expect(await readFile(path, "utf-8")).toEqual(before);
  });

  it("does nothing when the theme id isn't found", async () => {
    const path = await writeConfig();
    const before = await readFile(path, "utf-8");

    await appendCuratedTracks(path, "unknown-theme", [{ title: "X", artist: "Y" }]);

    expect(await readFile(path, "utf-8")).toEqual(before);
  });
});
