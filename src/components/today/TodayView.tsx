import { useEffect } from "react";
import { CrossBucketList } from "./CrossBucketList";
import { groupForToday } from "./group";
import { useTodayItems } from "./useTodayItems";
import type { CrossBucketItems } from "@/lib/items/today";

type TodayViewProps = {
  seed: CrossBucketItems | null;
  onSeedUsed: () => void;
};

export function TodayView({ seed, onSeedUsed }: TodayViewProps) {
  const { data, refetch, patchItem } = useTodayItems(seed);

  useEffect(() => {
    if (seed) onSeedUsed();
  }, [seed, onSeedUsed]);

  return (
    <div className="flex flex-col">
      <h2 className="sr-only">today</h2>

      <CrossBucketList
        data={data}
        sections={groupForToday(data?.items ?? [])}
        emptyText="nothing overdue or due today"
        onPatch={(item, patch) => void patchItem(item, patch)}
        onChanged={refetch}
        dueTimeOnly
      />
    </div>
  );
}
