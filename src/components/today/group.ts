import { relativeTime } from "@/lib/items/relative-day";
import type { items } from "@/lib/db/schema";
import type { CrossBucketSection } from "./CrossBucketList";

type Item = typeof items.$inferSelect;

export function groupForToday(list: Item[], now = new Date()): CrossBucketSection[] {
  const overdue: Item[] = [];
  const today: Item[] = [];
  for (const item of list) {
    if (!item.deadline) continue;
    const rel = relativeTime(item.deadline, now);
    if (rel === "overdue") overdue.push(item);
    else if (rel === "today") today.push(item);
  }
  return [
    ...(overdue.length > 0 ? [{ label: "overdue", items: overdue }] : []),
    ...(today.length > 0 ? [{ label: "today", items: today }] : []),
  ];
}
