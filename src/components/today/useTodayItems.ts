import { useCallback, useEffect, useState } from "react";
import { getTodayAction, searchItemsAction, updateItemAction } from "@/app/(app)/actions";
import type { CrossBucketItems } from "@/lib/items/today";
import type { items } from "@/lib/db/schema";
import { useUIStore } from "@/store/ui";
import { SEARCH_DEBOUNCE_MS } from "./constants";

type Item = typeof items.$inferSelect;

function load(query: string) {
  const q = query.trim();
  return q ? searchItemsAction(q) : getTodayAction();
}

export function useTodayItems(query: string) {
  const aiRefreshTick = useUIStore((s) => s.aiRefreshTick);
  const [data, setData] = useState<CrossBucketItems | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(
      () => {
        void load(query).then((result) => {
          if (!cancelled && result.ok) setData(result);
        });
      },
      query.trim() ? SEARCH_DEBOUNCE_MS : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, aiRefreshTick]);

  const refetch = useCallback(async () => {
    const result = await load(query);
    if (result.ok) setData(result);
  }, [query]);

  async function changeStatus(item: Item, status: string) {
    await updateItemAction(
      item.id,
      item.title,
      item.deadline ? item.deadline.toISOString() : null,
      status
    );
    await refetch();
  }

  return { data, refetch, changeStatus };
}
