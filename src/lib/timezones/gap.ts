import { clockTimeIn } from "@/lib/format-date";
import { offsetMinutes } from "@/lib/reminders/zoned";
import { UNSET_TIMEZONE } from "./constants";

export function timeGap(theirs: string, yours: string, now: Date): string | null {
  if (theirs === UNSET_TIMEZONE || yours === UNSET_TIMEZONE) return null;
  const diff = offsetMinutes(now, theirs) - offsetMinutes(now, yours);
  if (diff === 0) return null;
  const abs = Math.abs(diff);
  const minutes = abs % 60;
  const hours = minutes ? `${Math.floor(abs / 60)}:${String(minutes).padStart(2, "0")}` : abs / 60;
  return `${hours} h ${diff > 0 ? "ahead of" : "behind"} you`;
}

export function placesOf(people: { place: string | null }[]): {
  places: string[];
  differ: boolean;
} {
  const places = [...new Set(people.flatMap((p) => (p.place ? [p.place] : [])))];
  const unset = people.some((p) => p.place === null);
  return { places, differ: places.length + (unset ? 1 : 0) > 1 };
}

const differs = (at: Date, a: string, b: string) => offsetMinutes(at, a) !== offsetMinutes(at, b);

// "9am for Sam" when the person it's assigned to keeps another clock, else "9am India" when
// it was set on another clock than yours
export function otherClock(
  at: Date,
  yours: string,
  assignee: { name: string; timezone: string; isYou: boolean } | undefined,
  setOn: { timezone: string; place: string } | undefined
): string | null {
  if (assignee && !assignee.isYou && assignee.timezone !== UNSET_TIMEZONE) {
    if (differs(at, assignee.timezone, yours)) {
      return `${clockTimeIn(at, assignee.timezone)} for ${assignee.name}`;
    }
  }
  if (setOn && differs(at, setOn.timezone, yours)) {
    return `${clockTimeIn(at, setOn.timezone)} ${setOn.place}`;
  }
  return null;
}
