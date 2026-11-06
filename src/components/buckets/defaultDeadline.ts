import { daysToDisplayStr, parseDurationToDate } from "@/lib/duration";

export function defaultDeadline(offsetDays: number | null | undefined): string {
  if (offsetDays === null || offsetDays === undefined) return "";
  return parseDurationToDate(daysToDisplayStr(offsetDays)) ?? "";
}
