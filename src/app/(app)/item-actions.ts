"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { requireSession } from "./action-helpers";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { ITEM_TITLE_MAX_LENGTH } from "@/constants";
import type { RecurringConfig } from "@/types/rules";
import { parseDeadlineString } from "@/lib/time";
import { initialReminderState, reminderResetForDeadline } from "@/lib/items/reminders";
import { bucketDefaultOffsetMins, refreshItemReminders } from "@/lib/reminders/refresh";
import { createNextOccurrence, skipOccurrence } from "@/lib/items/recurrence";
import {
  getItemReminderInfo,
  getReminderBadges,
  type ItemReminderInfo,
  type ReminderBadge,
} from "@/lib/reminders/status";

export async function getItemsForBucketAction(bucketId: number): Promise<
  | {
      ok: true;
      items: (typeof items.$inferSelect)[];
      reminderBadges: Record<number, ReminderBadge>;
    }
  | { ok: false; error: string }
> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  let sortBy = "manual";
  try {
    const parsed = JSON.parse(bucket.itemsRules) as { sortBy?: string; sort_by?: string };
    sortBy = parsed.sortBy ?? parsed.sort_by ?? "manual";
  } catch (err) {
    process.stderr.write(
      `[actions] bucket ${bucketId} has malformed itemsRules: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }

  const condition = and(
    eq(items.bucketId, bucketId),
    eq(items.userId, session.userId),
    isNull(items.deletedAt)
  );

  const result =
    sortBy === "deadline"
      ? await db
          .select()
          .from(items)
          .where(condition)
          .orderBy(
            sql`${items.deadline} IS NULL`,
            asc(items.deadline),
            asc(items.createdAt),
            asc(items.id)
          )
      : sortBy === "created_at"
        ? await db
            .select()
            .from(items)
            .where(condition)
            .orderBy(asc(items.createdAt), asc(items.id))
        : await db
            .select()
            .from(items)
            .where(condition)
            .orderBy(asc(items.sortOrder), asc(items.createdAt), asc(items.id));

  const reminderBadges = await getReminderBadges(session.userId, bucket.notificationsRules, result);
  return { ok: true, items: result, reminderBadges };
}

export async function getItemReminderInfoAction(itemId: number): Promise<ItemReminderInfo | null> {
  const session = await requireSession();
  return getItemReminderInfo(session.userId, itemId);
}

export async function addItemAction(
  bucketId: number,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null,
  properties?: Record<string, unknown> | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
    .from(items)
    .where(eq(items.bucketId, bucketId));

  const parsedDeadline = deadline ? parseDeadlineString(deadline) : null;
  const [created] = await db
    .insert(items)
    .values({
      bucketId,
      userId: session.userId,
      title: trimmed,
      deadline: parsedDeadline,
      ...initialReminderState(parsedDeadline),
      status: status ?? "active",
      sortOrder: maxRow.max + 1,
      recurring: recurring?.enabled ? JSON.stringify(recurring) : null,
      properties: properties ? JSON.stringify(properties) : null,
    })
    .returning({ id: items.id });
  if (created) await refreshItemReminders([created.id]);

  revalidatePath("/");
  return { ok: true };
}

export async function updateItemAction(
  itemId: number,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null,
  properties?: Record<string, unknown> | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  const newDeadline = deadline ? parseDeadlineString(deadline) : null;
  const statusChanged = status !== undefined && status !== item.status;

  const nowCompleted = statusChanged && status === "completed" && item.status !== "completed";
  const nowUncompleted = statusChanged && status !== "completed" && item.status === "completed";

  await db
    .update(items)
    .set({
      title: trimmed,
      deadline: newDeadline,
      ...reminderResetForDeadline(item, newDeadline, await bucketDefaultOffsetMins(item.bucketId)),
      ...(status !== undefined && { status }),
      ...(nowCompleted && { completedAt: new Date() }),
      ...(nowUncompleted && { completedAt: null }),
      ...(recurring !== undefined && {
        recurring: recurring?.enabled ? JSON.stringify(recurring) : null,
      }),
      ...(properties !== undefined && {
        properties: properties ? JSON.stringify(properties) : null,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));
  await refreshItemReminders([itemId]);
  if (nowCompleted) await createNextOccurrence(itemId);

  revalidatePath("/");
  return { ok: true };
}

export async function skipOccurrenceAction(
  itemId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const result = await skipOccurrence(session.userId, itemId);
  if (result.ok) revalidatePath("/");
  return result;
}

export async function completeItemAction(
  itemId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  const newStatus = item.status === "completed" ? "active" : "completed";
  await db
    .update(items)
    .set({
      status: newStatus,
      completedAt: newStatus === "completed" ? new Date() : null,
      ...(newStatus === "active" && { overdueNotifiedAt: null }),
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));
  await refreshItemReminders([itemId]);
  if (newStatus === "completed") await createNextOccurrence(itemId);

  revalidatePath("/");
  return { ok: true };
}

export async function reorderItemsAction(
  bucketId: number,
  orderedIds: number[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .update(items)
        .set({ sortOrder: i })
        .where(and(eq(items.id, id), eq(items.userId, session.userId)))
    )
  );

  revalidatePath("/");
  return { ok: true };
}

export async function deleteItemAction(
  itemId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .update(items)
    .set({ deletedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));
  await refreshItemReminders([itemId]);

  revalidatePath("/");
  return { ok: true };
}
