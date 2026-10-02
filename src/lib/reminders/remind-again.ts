import { isClosedStatus } from "@/constants";
import type { items } from "@/lib/db/schema";

type Item = Pick<
  typeof items.$inferSelect,
  "status" | "remindNotBefore" | "nextReminderAt" | "nextOverdueAt"
>;

export function pendingRemindAgainAt(item: Item, now: Date): Date | null {
  if (isClosedStatus(item.status) || !item.remindNotBefore) return null;
  if (item.remindNotBefore.getTime() <= now.getTime()) return null;
  const pings = [item.nextReminderAt, item.nextOverdueAt]
    .filter((d): d is Date => d instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime());
  return pings[0] ?? item.remindNotBefore;
}
