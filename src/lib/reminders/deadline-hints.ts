import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, users, userSettings } from "@/lib/db/schema";
import { memberName } from "@/lib/buckets/member-name";
import { resolveDeadline } from "@/lib/items/deadline";
import { NotificationRules } from "@/types/rules";
import { memberChannels } from "@/lib/rules";
import { UNSET_TIMEZONE } from "@/lib/timezones/constants";
import { NIGHT_FROM_HOUR, NIGHT_TO_HOUR } from "./constants";
import { afterQuietHours, nextDeadlineReminder, type QuietHours } from "./schedule";
import { isAllDay, overdueFrom, toLocal } from "./zoned";

export type DeadlineHint = {
  name: string;
  isYou: boolean;
  // At night on their clock, for someone other than you
  night: boolean;
  quiet: boolean;
  heldPastDeadline: boolean;
};

export type DeadlineDraft = {
  deadline: string | null;
  clock: string | null;
  assigneeId: number | null;
  reminderOffsets: number[] | null;
};

// What a deadline being edited means for each person it would remind, quiet hours themselves
// stay on the server, only whether they get in the way is told
export async function deadlineHints(
  viewerId: number,
  bucketId: number,
  draft: DeadlineDraft
): Promise<DeadlineHint[] | null> {
  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      timezone: userSettings.timezone,
      quietFrom: userSettings.quietHoursFrom,
      quietTo: userSettings.quietHoursTo,
      rules: buckets.notificationsRules,
      channels: bucketMembers.channels,
    })
    .from(bucketMembers)
    .innerJoin(buckets, eq(buckets.id, bucketMembers.bucketId))
    .innerJoin(users, eq(users.id, bucketMembers.userId))
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(bucketMembers.bucketId, bucketId));
  const viewer = rows.find((r) => r.userId === viewerId);
  if (!viewer) return null;
  if (!draft.deadline) return [];

  const due = resolveDeadline(draft.deadline, draft.clock ?? viewer.timezone ?? UNSET_TIMEZONE);
  if (!due.deadline || !due.deadlineTimezone) return [];
  const deadline = due.deadline;
  const deadlineTimezone = due.deadlineTimezone;
  const timed = !isAllDay(deadline, deadlineTimezone);
  const rules = NotificationRules.parse(JSON.parse(viewer.rules));
  const assignee = rows.find((r) => r.userId === draft.assigneeId);
  const recipients = (assignee ? [assignee] : rows).filter(
    (r) => r.timezone && r.timezone !== UNSET_TIMEZONE
  );

  return recipients.flatMap((r) => {
    const timezone = r.timezone ?? UNSET_TIMEZONE;
    const own: QuietHours | null =
      r.quietFrom && r.quietTo ? { from: r.quietFrom, to: r.quietTo } : null;
    const isYou = r.userId === viewerId;
    const hour = toLocal(deadline, timezone).hour;
    const atNight = timed && !isYou && (hour >= NIGHT_FROM_HOUR || hour < NIGHT_TO_HOUR);
    const quiet = timed && afterQuietHours(deadline, [rules.quietHours, own], timezone) > deadline;
    const inputs = {
      deadline,
      deadlineTimezone,
      status: "active",
      deletedAt: null,
      bucketLive: true,
      remindNotBefore: null,
      notifiedAt: null,
      overdueNotifiedAt: null,
      reminderOffsets: draft.reminderOffsets,
      rules,
      channels: memberChannels(r.channels),
      sharedWebhooks: [],
      notifyWhenOverdue: false,
      overdueRepeatHours: undefined,
      timezone,
      userQuietHours: own,
    };
    const first = nextDeadlineReminder(inputs);
    const unheld = nextDeadlineReminder({
      ...inputs,
      rules: { ...rules, quietHours: null },
      userQuietHours: null,
    });
    const dueBy = timed ? deadline : overdueFrom(deadline, deadlineTimezone, timezone);
    const heldPastDeadline = !!first && !!unheld && unheld <= dueBy && first > dueBy;
    if (!atNight && !quiet && !heldPastDeadline) return [];
    return [
      {
        name: isYou ? "you" : memberName(r),
        isYou,
        night: atNight,
        quiet,
        heldPastDeadline,
      },
    ];
  });
}
