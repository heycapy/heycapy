import type { ItemId } from "@/types/ids";
import { isClosedStatus } from "@/constants";
import { useEffect, useRef, useState } from "react";
import { notify } from "@/components/ui/notify";
import {
  deleteItemAction,
  getItemsForBucketAction,
  moveItemAction,
  updateItemAction,
} from "@/app/(app)/actions";
import type { ListItem, ReminderBadge } from "@/lib/reminders/status";
import { useUIStore } from "@/store/ui";
import { reach } from "@/hooks/connectivity";
import { deadlineValue } from "@/lib/time";
import { readBucketSnapshot, saveBucketSnapshot } from "@/lib/offline/snapshot";
import type { ItemPatch } from "@/lib/items/edit-draft";
import { offerUndoDelete } from "./undoDelete";
import { withPatch } from "./optimistic";
import { saveItemPatch } from "./savePatch";
import { isTick, offerUndoTick } from "./undoTick";

type Item = ListItem;
type Loaded = { items: Item[]; reminderBadges: Record<ItemId, ReminderBadge> };

const lastLoaded = new Map<number, Loaded>();

function keep(bucketId: number, loaded: Loaded) {
  lastLoaded.set(bucketId, loaded);
  void saveBucketSnapshot(bucketId, loaded);
}

const shown = (list: Item[], showCompleted: boolean) =>
  showCompleted ? list : list.filter((i) => !isClosedStatus(i.status));

export function useBucketItems(bucketId: number, itemsRules: string, showCompleted: boolean) {
  const refreshTick = useUIStore((s) => s.refreshTick);
  const markItemsLoaded = useUIStore((s) => s.markItemsLoaded);
  const cached = lastLoaded.get(bucketId);
  const [fetchedItems, setFetchedItems] = useState<Item[]>(cached?.items ?? []);
  const [reminderBadges, setReminderBadges] = useState<Record<ItemId, ReminderBadge>>(
    cached?.reminderBadges ?? {}
  );
  const [loading, setLoading] = useState(!cached);
  const [orderedItems, setOrderedItems] = useState<Item[]>(() =>
    shown(cached?.items ?? [], showCompleted)
  );
  const orderedItemsRef = useRef<Item[]>(orderedItems);

  useEffect(() => {
    let cancelled = false;
    void reach(getItemsForBucketAction(bucketId)).then(async (result) => {
      if (cancelled) return;
      if (!result) {
        if (lastLoaded.has(bucketId)) return;
        const saved = await readBucketSnapshot(bucketId);
        if (cancelled || !saved) return;
        setFetchedItems(saved.items);
        setReminderBadges(saved.reminderBadges);
        setLoading(false);
        return;
      }
      if (result.ok) {
        keep(bucketId, result);
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
    if (!loading) markItemsLoaded();
  }, [fetchedItems, loading, markItemsLoaded]);

  useEffect(() => {
    const next = shown(fetchedItems, showCompleted);
    const id = setTimeout(() => {
      setOrderedItems(next);
      orderedItemsRef.current = next;
    }, 0);
    return () => clearTimeout(id);
  }, [fetchedItems, showCompleted]);

  async function refetch() {
    const result = await reach(getItemsForBucketAction(bucketId));
    if (!result?.ok) return;
    keep(bucketId, result);
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

  async function patchItem(item: Item, patch: ItemPatch) {
    setFetchedItems((list) => list.map((i) => (i.id === item.id ? withPatch(i, patch) : i)));
    await saveItemPatch(item, patch, refetch);
  }

  async function moveItem(item: Item, deadline: string) {
    const result = await moveItemAction(item.id, deadline);
    if (!result.ok) notify.error(result.error);
    await refetch();
  }

  async function deleteItem(itemId: ItemId) {
    const title = fetchedItems.find((i) => i.id === itemId)?.title ?? "item";
    const result = await deleteItemAction(itemId);
    await refetch();
    if (!result.ok) {
      notify.error(result.error);
      return;
    }
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
    patchItem,
    moveItem,
    deleteItem,
    reorder,
  };
}
