import { useCallback, useEffect, useRef, useState } from "react";
import { getTodayAction, searchItemsAction } from "@/app/(app)/actions";
import { withPatch } from "@/components/buckets/optimistic";
import { saveItemPatch } from "@/components/buckets/savePatch";
import type { ItemPatch } from "@/lib/items/edit-draft";
import type { CrossBucketItems } from "@/lib/items/today";
import type { ListItem } from "@/lib/reminders/status";
import type { ActionResult } from "@/types/result";
import { useUIStore } from "@/store/ui";
import { reach } from "@/hooks/connectivity";
import { SEARCH_DEBOUNCE_MS } from "./constants";

function useCrossBucketItems(
  load: () => Promise<ActionResult<CrossBucketItems>>,
  delay: number,
  seed: CrossBucketItems | null = null
) {
  const refreshTick = useUIStore((s) => s.refreshTick);
  const markItemsLoaded = useUIStore((s) => s.markItemsLoaded);
  const [data, setData] = useState<CrossBucketItems | null>(seed);
  const seeded = useRef(seed !== null);

  useEffect(() => {
    if (data) markItemsLoaded();
  }, [data, markItemsLoaded]);

  useEffect(() => {
    if (seeded.current) {
      seeded.current = false;
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      void reach(load()).then((result) => {
        if (!cancelled && result?.ok) setData(result);
      });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [load, delay, refreshTick]);

  const refetch = useCallback(async () => {
    const result = await reach(load());
    if (result?.ok) setData(result);
  }, [load]);

  async function patchItem(item: ListItem, patch: ItemPatch) {
    setData(
      (d) => d && { ...d, items: d.items.map((i) => (i.id === item.id ? withPatch(i, patch) : i)) }
    );
    await saveItemPatch(item, patch, refetch);
  }

  return { data, refetch, patchItem };
}

export function useTodayItems(seed: CrossBucketItems | null) {
  return useCrossBucketItems(getTodayAction, 0, seed);
}

export function useSearchItems(query: string) {
  const term = query.trim();
  const load = useCallback(
    (): Promise<ActionResult<CrossBucketItems>> =>
      term
        ? searchItemsAction(term)
        : Promise.resolve({ ok: true, items: [], buckets: [], reminderBadges: {}, assignees: {} }),
    [term]
  );
  return useCrossBucketItems(load, term ? SEARCH_DEBOUNCE_MS : 0);
}
