import type { ItemId } from "@/types/ids";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { DbHandle } from "@/lib/db/handle";
import { bucketMembers, itemAssignees, items } from "@/lib/db/schema";

export function bucketMemberIds(h: DbHandle, bucketId: number): number[] {
  const rows = h
    .select({ userId: bucketMembers.userId })
    .from(bucketMembers)
    .where(eq(bucketMembers.bucketId, bucketId))
    .all();
  return rows.map((r) => r.userId);
}

const AssigneeIds = z.array(z.number().int());

// A client sends the list, so its shape is checked as well as who is in it
export function allAreMembers(h: DbHandle, bucketId: number, userIds: unknown): boolean {
  const parsed = AssigneeIds.safeParse(userIds);
  if (!parsed.success) return false;
  const members = new Set(bucketMemberIds(h, bucketId));
  return parsed.data.every((id) => members.has(id));
}

// Only members still in the item's bucket count, the same rule that decides who is reminded
export function assigneeIdsByItem(h: DbHandle, itemIds: ItemId[]): Map<ItemId, number[]> {
  const byItem = new Map<ItemId, number[]>();
  if (itemIds.length === 0) return byItem;
  const rows = h
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
    .orderBy(itemAssignees.id)
    .all();
  for (const row of rows) byItem.set(row.itemId, [...(byItem.get(row.itemId) ?? []), row.userId]);
  return byItem;
}

export function setItemAssignees(h: DbHandle, itemId: ItemId, userIds: number[]): void {
  const wanted = [...new Set(userIds)];
  h.transaction((tx) => {
    tx.delete(itemAssignees).where(eq(itemAssignees.itemId, itemId)).run();
    if (wanted.length > 0) {
      tx.insert(itemAssignees)
        .values(wanted.map((userId) => ({ itemId, userId })))
        .run();
    }
  });
}

export function assignEveryone(h: DbHandle, itemId: ItemId, bucketId: number): void {
  setItemAssignees(h, itemId, bucketMemberIds(h, bucketId));
}

export function copyAssignees(h: DbHandle, fromItemId: ItemId, toItemId: ItemId): void {
  const from = assigneeIdsByItem(h, [fromItemId]);
  setItemAssignees(h, toItemId, from.get(fromItemId) ?? []);
}
