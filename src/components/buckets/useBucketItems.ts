import type { ItemId } from "@/types/ids";
import { isClosedStatus } from "@/constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { notify } from "@/components/ui/notify";
import {
  deleteItemAction,
  getReminderBadgesAction,
  moveItemAction,
  updateItemAction,
} from "@/app/(app)/actions";
import type { ListItem, ReminderBadge } from "@/lib/reminders/status";
import { useUIStore } from "@/store/ui";
import { reach } from "@/hooks/connectivity";
import { deadlineValue } from "@/lib/time";
import { parseItemsRules } from "@/lib/rules";
import { META_CURSOR } from "@/lib/sync/client/constants";
import { listBucketItems, localBadges, withServerBadges } from "@/lib/sync/client/read";
import { readMeta, readRecords } from "@/lib/sync/client/store";
import { subscribeToChanges, syncNow } from "@/hooks/useSync";
import type { ItemPatch } from "@/lib/items/edit-draft";
import { offerUndoDelete } from "./undoDelete";
import { withPatch } from "./optimistic";
import { saveItemPatch } from "./savePatch";
import { isTick, offerUndoTick } from "./undoTick";

type Item = ListItem;
type Loaded = { items: Item[]; reminderBadges: Record<ItemId, ReminderBadge> };

const lastLoaded = new Map<number, Loaded>();

const shown = (list: Item[], showCompleted: boolean) =>
  showCompleted ? list : list.filter((i) => !isClosedStatus(i.status));

export function useBucketItems(bucketId: number, itemsRules: string, showCompleted: boolean) {
  const markItemsLoaded = useUIStore((s) => s.markItemsLoaded);
  const refreshTick = useUIStore((s) => s.refreshTick);
  const sortBy = parseItemsRules(itemsRules).sortBy ?? "manual";
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
  const serverBadges = useRef<Record<ItemId, ReminderBadge>>({});

  // Null when nothing has been downloaded yet: the list is not empty, it is not here yet
  const read = useCallback(async (): Promise<Loaded | null> => {
    try {
      const [records, cursor] = await Promise.all([readRecords(), readMeta<number>(META_CURSOR)]);
      if (cursor === undefined) return null;
      const list = listBucketItems(records, bucketId, sortBy);
      return {
        items: list,
        reminderBadges: withServerBadges(list, localBadges(list), serverBadges.current),
      };
    } catch {
      notify.error("can't read the saved copy on this device");
      return null;
    }
  }, [bucketId, sortBy]);

  const show = useCallback(
    (loaded: Loaded | null) => {
      if (!loaded) return;
      lastLoaded.set(bucketId, loaded);
      setFetchedItems(loaded.items);
      setReminderBadges(loaded.reminderBadges);
      setLoading(false);
    },
    [bucketId]
  );

  const fetchServerBadges = useCallback(async () => {
    const result = await reach(getReminderBadgesAction(bucketId));
    if (!result?.ok) return false;
    serverBadges.current = result.reminderBadges;
    return true;
  }, [bucketId]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      void read().then((loaded) => {
        if (!cancelled) show(loaded);
      });
    refresh();
    const unsubscribe = subscribeToChanges(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [read, show]);

  // A delivery failure changes nothing that syncs, so the live-updates stream's tick asks again
  useEffect(() => {
    let cancelled = false;
    void fetchServerBadges().then(async (got) => {
      if (got && !cancelled) show(await read());
    });
    return () => {
      cancelled = true;
    };
  }, [fetchServerBadges, read, show, refreshTick]);

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

  // The server has just been written to: bring its answer into the device, then read it back
  async function refetch() {
    await syncNow();
    show(await read());
    if (await fetchServerBadges()) show(await read());
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
