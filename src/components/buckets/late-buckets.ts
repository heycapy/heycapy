import { relativeTime } from "@/lib/items/relative-day";
import { itemDeadline } from "@/lib/time";
import type { OpenItem } from "@/lib/items/open-items";

// Late means what it means in today's list, so a tab's mark matches the rows it holds
export function lateBucketIds(list: OpenItem[], now = new Date()): Set<number> {
  const late = new Set<number>();
  for (const item of list) {
    if (!item.deadline) continue;
    const due = itemDeadline(item.deadline, item.deadlineTimezone);
    if (relativeTime(due.at, now, due.allDay) === "overdue") late.add(item.bucketId);
  }
  return late;
}
