import { CrossBucketList } from "./CrossBucketList";
import { groupForToday } from "./group";
import { useTodayItems } from "./useTodayItems";

export function TodayView() {
  const { data, refetch, patchItem } = useTodayItems();

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
