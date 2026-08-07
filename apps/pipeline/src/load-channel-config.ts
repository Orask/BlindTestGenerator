import { readFile } from "node:fs/promises";
import { parseChannelConfig, type ChannelConfig } from "@blindtest/core";

export async function loadChannelConfig(path: string): Promise<ChannelConfig> {
  const raw = await readFile(path, "utf-8");
  return parseChannelConfig(JSON.parse(raw));
}
