import { isClosedStatus } from "@/constants";
import { useEffect, useRef, useState } from "react";
import { notify } from "@/components/ui/notify";
import {
  deleteItemAction,
  getItemsForBucketAction,
  moveItemAction,
  updateItemAction,
} from "@/app/(app)/actions";
import type { ReminderBadge } from "@/lib/reminders/status";
import type { items } from "@/lib/db/schema";
import { useUIStore } from "@/store/ui";
import { deadlineValue } from "@/lib/time";
import { offerUndoDelete } from "./undoDelete";
import { isTick, offerUndoTick } from "./undoTick";

type Item = typeof items.$inferSelect;
type Loaded = { items: Item[]; reminderBadges: Record<number, ReminderBadge> };

const lastLoaded = new Map<number, Loaded>();

const shown = (list: Item[], showCompleted: boolean) =>
  showCompleted ? list : list.filter((i) => !isClosedStatus(i.status));

export function useBucketItems(bucketId: number, itemsRules: string, showCompleted: boolean) {
  const refreshTick = useUIStore((s) => s.refreshTick);
  const markItemsLoaded = useUIStore((s) => s.markItemsLoaded);
  const cached = lastLoaded.get(bucketId);
  const [fetchedItems, setFetchedItems] = useState<Item[]>(cached?.items ?? []);
  const [reminderBadges, setReminderBadges] = useState<Record<number, ReminderBadge>>(
    cached?.reminderBadges ?? {}
  );
  const [loading, setLoading] = useState(!cached);
  const [orderedItems, setOrderedItems] = useState<Item[]>(() =>
    shown(cached?.items ?? [], showCompleted)
  );
  const orderedItemsRef = useRef<Item[]>(orderedItems);

  useEffect(() => {
    let cancelled = false;
    void getItemsForBucketAction(bucketId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        lastLoaded.set(bucketId, result);
        setFetchedItems(result.items);
        setReminderBadges(result.reminderBadges);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bucketId, itemsRules, refreshTick]);

  useEffect(() => {
    markItemsLoaded();
  }, [fetchedItems, markItemsLoaded]);

  useEffect(() => {
    const next = shown(fetchedItems, showCompleted);
    const id = setTimeout(() => {
      setOrderedItems(next);
      orderedItemsRef.current = next;
    }, 0);
    return () => clearTimeout(id);
  }, [fetchedItems, showCompleted]);

  async function refetch() {
    const result = await getItemsForBucketAction(bucketId);
    if (!result.ok) return;
    lastLoaded.set(bucketId, result);
    setFetchedItems(result.items);
    setReminderBadges(result.reminderBadges);
  }

  async function changeStatus(item: Item, status: string) {
    const result = await updateItemAction(
      item.id,
      item.title,
      item.deadline ? deadlineValue(item.deadline, item.deadlineTimezone) : null,
      status
    );
    if (!result.ok) notify.error(result.error);
    await refetch();
    if (result.ok && isTick(item, status)) {
      offerUndoTick(item, () => changeStatus(item, item.status));
    }
    return result.ok;
  }

  async function moveItem(item: Item, deadline: string) {
    const result = await moveItemAction(item.id, deadline);
    if (!result.ok) notify.error(result.error);
    await refetch();
  }

  async function deleteItem(itemId: number) {
    const title = fetchedItems.find((i) => i.id === itemId)?.title ?? "item";
    await deleteItemAction(itemId);
    await refetch();
    offerUndoDelete(itemId, title, refetch);
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
    moveItem,
    deleteItem,
    reorder,
  };
}
