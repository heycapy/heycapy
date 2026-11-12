import { useCallback, useState } from "react";
import type { BucketMember } from "@/lib/buckets/members";
import { UNSET_TIMEZONE } from "@/lib/timezones/constants";
import { browserTimezone } from "@/lib/time";
import { resolveAssignees } from "./assignee";

export type ClockOption = { timezone: string; place: string };

function clockOptions(members: BucketMember[]): ClockOption[] {
  const options: ClockOption[] = [];
  for (const member of [...members].sort((a, b) => Number(b.isYou) - Number(a.isYou))) {
    if (member.place && !options.some((o) => o.place === member.place)) {
      options.push({ timezone: member.timezone, place: member.place });
    }
  }
  return options;
}

export function useItemClock(members: BucketMember[], assigneeIds: number[] | null) {
  const [picked, setPicked] = useState<string | null>(null);
  const reset = useCallback(() => setPicked(null), []);

  // A time is read on someone else's clock only when the item is for that one person
  function clockFor(ids: number[] | null, pick = picked): string | null {
    if (pick) return pick;
    const resolved = resolveAssignees(members, ids);
    const assignee = resolved.length === 1 ? members.find((m) => m.userId === resolved[0]) : null;
    if (!assignee || assignee.isYou || assignee.timezone === UNSET_TIMEZONE) return null;
    return assignee.timezone;
  }

  const clock = clockFor(assigneeIds);
  const options = clockOptions(members);
  const placeOf = (timezone: string | null) =>
    members.find((m) => (timezone ? m.timezone === timezone : m.isYou))?.place ?? null;

  return {
    clock,
    zone: clock ?? browserTimezone(),
    zoneFor: (ids: number[] | null, pick = picked) => clockFor(ids, pick) ?? browserTimezone(),
    options: options.length > 1 ? options : [],
    place: placeOf(clock),
    pick: setPicked,
    reset,
  };
}
