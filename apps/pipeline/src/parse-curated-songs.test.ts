import { describe, expect, it } from "vitest";
import { parseCuratedSongsNdjson } from "./parse-curated-songs.js";

describe("parseCuratedSongsNdjson", () => {
  it("parses one artist per line into the expected map", () => {
    const text = [
      '{"artist": "Indila", "songs": ["Dernière danse", "Tourner dans le vide"]}',
      '{"artist": "Stromae", "songs": ["Alors on danse"]}',
    ].join("\n");

    expect(parseCuratedSongsNdjson(text)).toEqual({
      Indila: ["Dernière danse", "Tourner dans le vide"],
      Stromae: ["Alors on danse"],
    });
  });

  it("skips blank lines", () => {
    const text = ['{"artist": "Indila", "songs": ["Dernière danse"]}', "", "   ", ""].join("\n");

    expect(parseCuratedSongsNdjson(text)).toEqual({ Indila: ["Dernière danse"] });
  });

  it("keeps every complete line even when the last one is truncated", () => {
    const text = [
      '{"artist": "Indila", "songs": ["Dernière danse"]}',
      '{"artist": "Stromae", "songs": ["Alors on da', // cut off mid-response
    ].join("\n");

    expect(parseCuratedSongsNdjson(text)).toEqual({ Indila: ["Dernière danse"] });
  });

  it("skips a line with the wrong shape instead of throwing", () => {
    const text = [
      '{"artist": "Indila", "songs": ["Dernière danse"]}',
      '{"artist": "Stromae"}',
      '{"not": "expected"}',
      "not even json",
    ].join("\n");

    expect(parseCuratedSongsNdjson(text)).toEqual({ Indila: ["Dernière danse"] });
  });

  it("returns an empty object for empty input", () => {
    expect(parseCuratedSongsNdjson("")).toEqual({});
  });
});
