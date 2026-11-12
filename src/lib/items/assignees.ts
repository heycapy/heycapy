import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { bucketMembers, itemAssignees, items } from "@/lib/db/schema";

export async function bucketMemberIds(bucketId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: bucketMembers.userId })
    .from(bucketMembers)
    .where(eq(bucketMembers.bucketId, bucketId));
  return rows.map((r) => r.userId);
}

const AssigneeIds = z.array(z.number().int());

// A client sends the list, so its shape is checked as well as who is in it
export async function allAreMembers(bucketId: number, userIds: unknown): Promise<boolean> {
  const parsed = AssigneeIds.safeParse(userIds);
  if (!parsed.success) return false;
  const members = new Set(await bucketMemberIds(bucketId));
  return parsed.data.every((id) => members.has(id));
}

// Only members still in the item's bucket count, the same rule that decides who is reminded
export async function assigneeIdsByItem(itemIds: number[]): Promise<Map<number, number[]>> {
  const byItem = new Map<number, number[]>();
  if (itemIds.length === 0) return byItem;
  const rows = await db
    .select({ itemId: itemAssignees.itemId, userId: itemAssignees.userId })
    .from(itemAssignees)
    .innerJoin(items, eq(items.id, itemAssignees.itemId))
    .innerJoin(
      bucketMembers,
      and(
        eq(bucketMembers.bucketId, items.bucketId),
        eq(bucketMembers.userId, itemAssignees.userId)
      )
    )
    .where(inArray(itemAssignees.itemId, itemIds))
    .orderBy(itemAssignees.id);
  for (const row of rows) byItem.set(row.itemId, [...(byItem.get(row.itemId) ?? []), row.userId]);
  return byItem;
}

export async function setItemAssignees(itemId: number, userIds: number[]): Promise<void> {
  const wanted = [...new Set(userIds)];
  db.transaction((tx) => {
    tx.delete(itemAssignees).where(eq(itemAssignees.itemId, itemId)).run();
    if (wanted.length > 0) {
      tx.insert(itemAssignees)
        .values(wanted.map((userId) => ({ itemId, userId })))
        .run();
    }
  });
}

export async function assignEveryone(itemId: number, bucketId: number): Promise<void> {
  await setItemAssignees(itemId, await bucketMemberIds(bucketId));
}

export async function copyAssignees(fromItemId: number, toItemId: number): Promise<void> {
  const from = await assigneeIdsByItem([fromItemId]);
  await setItemAssignees(toItemId, from.get(fromItemId) ?? []);
}
