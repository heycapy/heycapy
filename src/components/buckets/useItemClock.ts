import { useCallback, useState } from "react";
import type { BucketMember } from "@/lib/buckets/members";
import { UNSET_TIMEZONE } from "@/lib/timezones/constants";
import { browserTimezone } from "@/lib/time";

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

export function useItemClock(members: BucketMember[], assigneeId: number | null) {
  const [picked, setPicked] = useState<string | null>(null);
  const reset = useCallback(() => setPicked(null), []);

  function clockFor(id: number | null, pick = picked): string | null {
    if (pick) return pick;
    const assignee = members.find((m) => m.userId === id);
    if (!assignee || assignee.isYou || assignee.timezone === UNSET_TIMEZONE) return null;
    return assignee.timezone;
  }

  const clock = clockFor(assigneeId);
  const options = clockOptions(members);
  const placeOf = (timezone: string | null) =>
    members.find((m) => (timezone ? m.timezone === timezone : m.isYou))?.place ?? null;

  return {
    clock,
    zone: clock ?? browserTimezone(),
    zoneFor: (id: number | null, pick = picked) => clockFor(id, pick) ?? browserTimezone(),
    options: options.length > 1 ? options : [],
    place: placeOf(clock),
    pick: setPicked,
    reset,
  };
}
