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
