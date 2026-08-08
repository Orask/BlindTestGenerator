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

/**
 * The next calendar date `day` falls on, strictly after `from` (1-7 days
 * out) — used to schedule a week of episodes ahead without ever re-picking
 * a day that's already happened this week.
 */
export function nextOccurrenceOf(day: Weekday, from: Date): Date {
  const fromIndex = WEEKDAY_BY_JS_DAY.indexOf(weekdayFromDate(from));
  const targetIndex = WEEKDAY_BY_JS_DAY.indexOf(day);
  const daysUntil = ((targetIndex - fromIndex + 7 - 1) % 7) + 1;

  const result = new Date(from);
  result.setDate(result.getDate() + daysUntil);
  return result;
}

/** Combines nextOccurrenceOf with a local hour-of-day, for scheduling a publish time. */
export function nextPublishDateTime(day: Weekday, from: Date, hourLocal: number): Date {
  const date = nextOccurrenceOf(day, from);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hourLocal, 0, 0, 0);
}
