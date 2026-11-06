import { ItemDialog } from "@/components/buckets/ItemDialog";
import type { ItemPanel } from "@/components/buckets/ItemPanelFrame";
import { useItemEditor } from "@/components/buckets/useItemEditor";
import { useBucketMembers } from "@/components/buckets/useBucketMembers";
import { parseFields } from "@/components/buckets/fields";
import { DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { parseNotificationRules } from "@/lib/rules";
import { ITEM_STATUS } from "@/constants";
import type { buckets as bucketsTable } from "@/lib/db/schema";
import { CrossBucketList } from "./CrossBucketList";
import { groupForToday } from "./group";
import { useTodayItems } from "./useTodayItems";

type BucketRow = typeof bucketsTable.$inferSelect;

// Today only edits, items are added in their bucket
type TodayViewProps = {
  buckets: BucketRow[];
  panel?: ItemPanel;
};

export function TodayView({ buckets, panel }: TodayViewProps) {
  const { data, refetch } = useTodayItems();
  const statuses = DEFAULT_BUCKET_STATUSES;
  const editor = useItemEditor({
    bucketId: 0,
    defaultStatus: statuses.find((s) => s.isDefault)?.name ?? ITEM_STATUS.active,
    defaultDeadline: () => "",
    onSaved: refetch,
  });

  const editingItem = data?.items.find((i) => i.id === editor.editingItemId);
  const formBucket = buckets.find((b) => b.id === editingItem?.bucketId);
  const fields = parseFields(formBucket?.fieldSchema);
  const members = useBucketMembers(formBucket?.id ?? null, editor.dialogProps.open);

  return (
    <div className="flex flex-col">
      <h2 className="sr-only">today</h2>

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
        bucketReminders={
          formBucket && parseNotificationRules(formBucket.notificationsRules).defaultReminders
        }
        statuses={statuses}
        fields={fields.length > 0 ? fields : undefined}
        panel={panel && { ...panel, bucketName: formBucket?.name }}
        assigneeChoice={
          formBucket && {
            bucketId: formBucket.id,
            members,
            value: editor.assigneeId,
            onChange: editor.setAssigneeId,
          }
        }
      />
    </div>
  );
}
