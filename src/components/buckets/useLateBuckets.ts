import { useEffect, useState } from "react";
import { getOpenItemsAction } from "@/app/(app)/actions";
import { useUIStore } from "@/store/ui";
import { reach } from "@/hooks/connectivity";
import { lateBucketIds } from "./late-buckets";

export function useLateBuckets(): Set<number> {
  const refreshTick = useUIStore((s) => s.refreshTick);
  const itemsLoaded = useUIStore((s) => s.itemsLoaded);
  const [late, setLate] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (itemsLoaded === 0) return;
    let current = true;
    void reach(getOpenItemsAction()).then((result) => {
      if (current && result?.ok) setLate(lateBucketIds(result.items));
    });
    return () => {
      current = false;
    };
  }, [refreshTick, itemsLoaded]);

  return late;
}
