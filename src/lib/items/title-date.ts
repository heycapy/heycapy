import * as chrono from "chrono-node";
import {
  TITLE_DATE_AMBIGUOUS_WORDS,
  TITLE_DATE_LEAD_WORDS,
  TITLE_DATE_MORNING,
  TITLE_DATE_MORNING_HOUR,
  TITLE_DATE_TIME_WORDS,
} from "@/constants";
import { buildDeadline, deadlineDate, defaultTimeFor } from "@/lib/time";

export type TitleDate = {
  // The words read as a date, as positions in the typed title
  start: number;
  end: number;
  title: string;
  // Same shape the date and time pickers produce
  deadline: string;
};

function isDate(result: chrono.ParsedResult): boolean {
  const { start } = result;
  if (TITLE_DATE_AMBIGUOUS_WORDS.includes(result.text.toLowerCase())) return false;
  // A month on its own ("march on washington") isn't a date to set
  const onlyMonth =
    start.isCertain("month") &&
    !start.isCertain("day") &&
    !start.isCertain("weekday") &&
    !start.isCertain("hour");
  return !onlyMonth;
}

function withLeadWord(title: string, start: number): number {
  const before = title.slice(0, start).match(/(\S+)\s+$/);
  return before && TITLE_DATE_LEAD_WORDS.includes(before[1].toLowerCase())
    ? start - before[0].length
    : start;
}

function toDeadline(result: chrono.ParsedResult, now: Date): string {
  const date = result.start.date();
  if (result.start.isCertain("hour")) return date.toISOString();
  if (TITLE_DATE_MORNING.test(result.text)) {
    date.setHours(TITLE_DATE_MORNING_HOUR, 0, 0, 0);
    return date.toISOString();
  }
  if (TITLE_DATE_TIME_WORDS.test(result.text)) return date.toISOString();
  const day = deadlineDate(date.toISOString());
  const time = defaultTimeFor(day, now);
  return buildDeadline(day, time.hour, time.min, time.ampm);
}

export function findTitleDate(title: string, now = new Date()): TitleDate | null {
  const result = chrono.en.casual.parse(title, now, { forwardDate: true }).find((r) => isDate(r));
  if (!result) return null;
  const start = withLeadWord(title, result.index);
  const end = result.index + result.text.length;
  const rest = `${title.slice(0, start)} ${title.slice(end)}`.replace(/\s+/g, " ").trim();
  if (!rest) return null;
  return { start, end, title: rest, deadline: toDeadline(result, now) };
}
