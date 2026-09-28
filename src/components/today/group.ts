import { UPCOMING_DAYS } from "@/constants";
import { daysFromToday, relativeTime } from "@/lib/items/relative-day";
import type { items } from "@/lib/db/schema";

type Item = typeof items.$inferSelect;

export type TodaySection = { label: string; items: Item[] };

function dayLabel(date: Date, diffDays: number): string {
  if (diffDays === 1) return "tomorrow";
  return date
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    .replace(",", "")
    .toLowerCase();
}

export function groupForToday(list: Item[], now = new Date()): TodaySection[] {
  const sections: TodaySection[] = [];
  const push = (label: string, item: Item) => {
    const last = sections[sections.length - 1];
    if (last?.label === label) last.items.push(item);
    else sections.push({ label, items: [item] });
  };
  for (const item of list) {
    if (!item.deadline) continue;
    const rel = relativeTime(item.deadline, now);
    const diffDays = daysFromToday(item.deadline, now);
    if (rel === "overdue") push("overdue", item);
    else if (rel === "today") push("today", item);
    else if (diffDays <= UPCOMING_DAYS) push(dayLabel(item.deadline, diffDays), item);
  }
  return sections;
}
