import type { ChannelConfig } from "@blindtest/core";
import { upsertChannel, upsertChannelTheme } from "@blindtest/db";
import type Database from "better-sqlite3";

/** Keeps the DB's channel/theme rows (needed for foreign keys) in sync with the JSON config. */
export function syncChannelToDb(db: Database.Database, channel: ChannelConfig): void {
  upsertChannel(db, {
    id: channel.id,
    name: channel.name,
    language: channel.language,
    visibility: channel.visibility,
  });

  for (const theme of channel.themes) {
    upsertChannelTheme(db, {
      id: theme.id,
      channelId: channel.id,
      day: theme.day,
      label: theme.label,
    });
  }
}
