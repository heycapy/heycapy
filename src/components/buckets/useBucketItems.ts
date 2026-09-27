"use client";

import { useEffect, useRef, useState } from "react";
import { deleteItemAction, getItemsForBucketAction, updateItemAction } from "@/app/(app)/actions";
import type { ReminderBadge } from "@/lib/reminders/status";
import type { items } from "@/lib/db/schema";
import { useUIStore } from "@/store/ui";

type Item = typeof items.$inferSelect;

export function useBucketItems(bucketId: number, itemsRules: string, showCompleted: boolean) {
  const aiRefreshTick = useUIStore((s) => s.aiRefreshTick);
  const [fetchedItems, setFetchedItems] = useState<Item[]>([]);
  const [reminderBadges, setReminderBadges] = useState<Record<number, ReminderBadge>>({});
  const [loading, setLoading] = useState(true);
  const [orderedItems, setOrderedItems] = useState<Item[]>([]);
  const orderedItemsRef = useRef<Item[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getItemsForBucketAction(bucketId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setFetchedItems(result.items);
        setReminderBadges(result.reminderBadges);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bucketId, itemsRules, aiRefreshTick]);

  useEffect(() => {
    const next = showCompleted
      ? fetchedItems
      : fetchedItems.filter((i) => i.status !== "completed");
    const id = setTimeout(() => {
      setOrderedItems(next);
      orderedItemsRef.current = next;
    }, 0);
    return () => clearTimeout(id);
  }, [fetchedItems, showCompleted]);

  async function refetch() {
    const result = await getItemsForBucketAction(bucketId);
    if (!result.ok) return;
    setFetchedItems(result.items);
    setReminderBadges(result.reminderBadges);
  }

  async function changeStatus(item: Item, status: string) {
    await updateItemAction(
      item.id,
      item.title,
      item.deadline ? item.deadline.toISOString() : null,
      status
    );
    await refetch();
  }

  async function deleteItem(itemId: number) {
    await deleteItemAction(itemId);
    await refetch();
  }

  function reorder(newOrder: Item[]) {
    orderedItemsRef.current = newOrder;
    setOrderedItems(newOrder);
  }

  return {
    items: fetchedItems,
    orderedItems,
    orderedItemsRef,
    reminderBadges,
    loading,
    refetch,
    changeStatus,
    deleteItem,
    reorder,
  };
}
