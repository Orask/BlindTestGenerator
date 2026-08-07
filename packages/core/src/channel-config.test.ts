import { describe, expect, it } from "vitest";
import { parseChannelConfig } from "./channel-config.js";

const validConfig = {
  id: "blindtest-fr",
  name: "BlindTest FR",
  language: "fr",
  visibility: "private",
  themes: [
    {
      day: "monday",
      id: "annees-80",
      label: "Années 80",
      spotifySeed: "genre:80s-fr",
      youtubePlaylistId: null,
    },
  ],
};

describe("parseChannelConfig", () => {
  it("accepts a well-formed channel config", () => {
    expect(parseChannelConfig(validConfig)).toEqual(validConfig);
  });

  it("rejects a config with an invalid visibility value", () => {
    expect(() => parseChannelConfig({ ...validConfig, visibility: "hidden" })).toThrow();
  });

  it("rejects a config with no themes", () => {
    expect(() => parseChannelConfig({ ...validConfig, themes: [] })).toThrow();
  });

  it("rejects a theme with an invalid weekday", () => {
    const invalid = {
      ...validConfig,
      themes: [{ ...validConfig.themes[0], day: "someday" }],
    };
    expect(() => parseChannelConfig(invalid)).toThrow();
  });
});
