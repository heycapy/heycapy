import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { reminderButtonLabel } from "@/lib/notifications/constants";
import { bucketReminderButtons } from "@/lib/rules";
import { signReminderAction, type ReminderAction, type ReminderChannel } from "./action-token";

export type ReminderButton = { action: ReminderAction; label: string; token: string };

export type ReminderLinks = {
  path: string;
  buttons: ReminderButton[];
};

export async function reminderLinks(
  userId: number,
  itemId: number,
  remindSlots: number,
  channel: ReminderChannel,
  now = new Date()
): Promise<ReminderLinks | null> {
  const [row] = await db
    .select({
      deadline: items.deadline,
      bucketId: items.bucketId,
      rules: buckets.notificationsRules,
    })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(eq(items.id, itemId))
    .limit(1);
  if (!row) return null;

  const claim = { userId, itemId, channel, deadline: row.deadline?.getTime() ?? null };
  const picks = bucketReminderButtons(row.rules).slice(0, remindSlots);
  const button = (action: ReminderAction, label: string): ReminderButton => ({
    action,
    label,
    token: signReminderAction({ ...claim, action }, now),
  });
  return {
    path: `/?bucket=${row.bucketId}#item-${itemId}`,
    buttons: [
      button("done", "✓ done"),
      ...picks.map((p) => button(p, `⏰ ${reminderButtonLabel(p)}`)),
    ],
  };
}
