import type { ChannelTheme, Weekday } from "./channel-config.js";

const WEEKDAY_BY_JS_DAY: readonly Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function weekdayFromDate(date: Date): Weekday {
  return WEEKDAY_BY_JS_DAY[date.getDay()]!;
}

export function resolveThemeForDay(themes: readonly ChannelTheme[], day: Weekday): ChannelTheme {
  const theme = themes.find((candidate) => candidate.day === day);
  if (!theme) {
    throw new Error(`No theme configured for day "${day}".`);
  }
  return theme;
}
