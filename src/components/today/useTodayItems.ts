import { useCallback, useEffect, useState } from "react";
import { getTodayAction, searchItemsAction } from "@/app/(app)/actions";
import type { CrossBucketItems } from "@/lib/items/today";
import type { ActionResult } from "@/types/result";
import { useUIStore } from "@/store/ui";
import { SEARCH_DEBOUNCE_MS } from "./constants";

function useCrossBucketItems(load: () => Promise<ActionResult<CrossBucketItems>>, delay: number) {
  const aiRefreshTick = useUIStore((s) => s.aiRefreshTick);
  const [data, setData] = useState<CrossBucketItems | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      void load().then((result) => {
        if (!cancelled && result.ok) setData(result);
      });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [load, delay, aiRefreshTick]);

  const refetch = useCallback(async () => {
    const result = await load();
    if (result.ok) setData(result);
  }, [load]);

  return { data, refetch };
}

export function useTodayItems() {
  return useCrossBucketItems(getTodayAction, 0);
}

export function useSearchItems(query: string) {
  const term = query.trim();
  const load = useCallback(
    (): Promise<ActionResult<CrossBucketItems>> =>
      term
        ? searchItemsAction(term)
        : Promise.resolve({ ok: true, items: [], buckets: [], reminderBadges: {} }),
    [term]
  );
  return useCrossBucketItems(load, term ? SEARCH_DEBOUNCE_MS : 0);
}
