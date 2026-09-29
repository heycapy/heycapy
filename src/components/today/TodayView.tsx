import { useEffect, type RefObject } from "react";
import { Clock } from "lucide-react";
import { BracketButton } from "@/components/ui/BracketButton";
import { ItemDialog } from "@/components/buckets/ItemDialog";
import { useItemEditor } from "@/components/buckets/useItemEditor";
import { parseFields } from "@/components/buckets/fields";
import { BUCKET_PALETTE, DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { parseItemsRules } from "@/lib/rules";
import { localDateString } from "@/lib/reminders/zoned";
import { ITEM_STATUS } from "@/constants";
import { useUIStore } from "@/store/ui";
import type { buckets as bucketsTable } from "@/lib/db/schema";
import { CrossBucketList } from "./CrossBucketList";
import { groupForToday } from "./group";
import { useTodayItems } from "./useTodayItems";

type BucketRow = typeof bucketsTable.$inferSelect;

type TodayViewProps = {
  buckets: BucketRow[];
  addItemRef: RefObject<(() => void) | null>;
};

export function TodayView({ buckets, addItemRef }: TodayViewProps) {
  const { data, refetch } = useTodayItems();
  const todayAddBucketId = useUIStore((s) => s.todayAddBucketId);
  const activeBucketId = useUIStore((s) => s.activeBucketId);
  const setTodayAddBucketId = useUIStore((s) => s.setTodayAddBucketId);

  const addable = buckets.flatMap((bucket, i) =>
    parseItemsRules(bucket.itemsRules).readonly === true
      ? []
      : [{ bucket, color: BUCKET_PALETTE[i % BUCKET_PALETTE.length] ?? "" }]
  );
  const addTo =
    addable.find((a) => a.bucket.id === todayAddBucketId) ??
    addable.find((a) => a.bucket.id === activeBucketId) ??
    addable[0];

  const statuses = DEFAULT_BUCKET_STATUSES;
  const editor = useItemEditor({
    bucketId: addTo?.bucket.id ?? 0,
    defaultStatus: statuses.find((s) => s.isDefault)?.name ?? ITEM_STATUS.active,
    defaultDeadline: () =>
      localDateString(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
    onSaved: refetch,
  });

  useEffect(() => {
    if (!addTo) return;
    addItemRef.current = editor.startAdding;
    return () => {
      addItemRef.current = null;
    };
  });

  const adding = editor.dialogProps.open && editor.dialogProps.mode === "add";
  const editingItem = data?.items.find((i) => i.id === editor.editingItemId);
  const fields = parseFields(
    (adding ? addTo?.bucket : buckets.find((b) => b.id === editingItem?.bucketId))?.fieldSchema
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="flex items-center gap-1.5 font-mono text-sm font-normal">
          <Clock size={13} aria-hidden />
          today
        </h2>
        {addTo && (
          <BracketButton onClick={editor.startAdding} className="hidden px-1 py-1.5 md:inline-flex">
            add +
          </BracketButton>
        )}
      </div>

      <CrossBucketList
        data={data}
        sections={groupForToday(data?.items ?? [])}
        emptyText="nothing overdue or due today"
        editingItemId={editor.editingItemId}
        onEdit={editor.startEditing}
        onChanged={refetch}
      />

      <ItemDialog
        {...editor.dialogProps}
        statuses={statuses}
        fields={fields.length > 0 ? fields : undefined}
        bucketChoice={
          adding && addTo
            ? {
                options: addable.map((a) => ({
                  id: a.bucket.id,
                  name: a.bucket.icon ? `${a.bucket.icon} ${a.bucket.name}` : a.bucket.name,
                  color: a.color,
                })),
                value: addTo.bucket.id,
                onChange: (id) => {
                  setTodayAddBucketId(id);
                  editor.dialogProps.onPropertiesChange({});
                },
              }
            : undefined
        }
      />
    </div>
  );
}
