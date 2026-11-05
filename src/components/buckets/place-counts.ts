import { relativeTime } from "@/lib/items/relative-day";
import { itemDeadline } from "@/lib/time";
import type { OpenItem } from "@/lib/items/open-items";

export type PlaceCount = { open: number; late: number };

export type PlaceCounts = { today: number; buckets: Record<number, PlaceCount> };

// Late and today mean what they mean in today's list, so its count matches what it shows
export function countPlaces(list: OpenItem[], now = new Date()): PlaceCounts {
  const counts: PlaceCounts = { today: 0, buckets: {} };
  for (const item of list) {
    const bucket = (counts.buckets[item.bucketId] ??= { open: 0, late: 0 });
    bucket.open += 1;
    if (!item.deadline) continue;
    const due = itemDeadline(item.deadline, item.deadlineTimezone);
    const rel = relativeTime(due.at, now, due.allDay);
    if (rel === "overdue") bucket.late += 1;
    if (rel === "overdue" || rel === "today") counts.today += 1;
  }
  return counts;
}
