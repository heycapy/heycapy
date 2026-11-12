import { DUE_NEAR_DAYS, DUE_WEEKDAY_DAYS, ITEM_STATUS, WEEKDAY_SHORT_NAMES } from "@/constants";
import { dueClock, dueDate } from "@/lib/format-date";
import { daysFromToday } from "./relative-day";

export type DueTone = "late" | "today" | "near" | "later" | "closed";

// `short` fits a phone's narrow column, `full` is shown when the list is wide
export type DueLabel = { tone: DueTone; state: string; short: string; full: string };

export function dueLabel(
  due: { at: Date; allDay: boolean },
  status: string,
  now = new Date()
): DueLabel {
  const days = daysFromToday(due.at, now);
  const time = due.allDay ? "all day" : dueClock(due.at);
  const day = dueDate(due.at);
  const dayAndTime = due.allDay ? day : `${day} ${time}`;
  const weekday = WEEKDAY_SHORT_NAMES[due.at.getDay()] ?? day;

  if (status === ITEM_STATUS.completed) {
    return { tone: "closed", state: "done", short: day, full: dayAndTime };
  }
  if (status === ITEM_STATUS.missed) {
    return { tone: "closed", state: "missed", short: day, full: dayAndTime };
  }
  if (days < 0) return { tone: "late", state: `${-days}d late`, short: day, full: dayAndTime };
  if (days === 0) {
    const late = !due.allDay && due.at < now;
    return {
      tone: late ? "late" : "today",
      state: late ? "late" : "today",
      short: time,
      full: time,
    };
  }

  const state = days === 1 ? "tomorrow" : `in ${days}d`;
  const tone = days <= DUE_NEAR_DAYS ? "near" : "later";
  if (days <= DUE_WEEKDAY_DAYS) {
    return { tone, state, short: weekday, full: `${weekday} ${dayAndTime}` };
  }
  return { tone, state, short: day, full: dayAndTime };
}
