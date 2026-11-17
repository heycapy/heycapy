import { InlineItemEditor } from "@/components/buckets/InlineItemEditor";
import { parseFields } from "@/components/buckets/fields";
import { DEFAULT_BUCKET_STATUSES, type OpenFocus } from "@/components/buckets/constants";
import { useBucketMembers } from "@/components/buckets/useBucketMembers";
import type { ItemPatch } from "@/lib/items/edit-draft";
import type { ItemBucket } from "@/lib/items/today";
import type { ListItem } from "@/lib/reminders/status";

type CrossBucketEditorProps = {
  item: ListItem;
  focus: OpenFocus;
  bucket: ItemBucket;
  color: string;
  onCommit: (patch: ItemPatch) => void;
  onExit: (focusRow: boolean) => void;
};

// An item from Today or search opens with its own bucket's people, fields and reminders
export function CrossBucketEditor({
  item,
  focus,
  bucket,
  color,
  onCommit,
  onExit,
}: CrossBucketEditorProps) {
  const members = useBucketMembers(bucket.id, item.id);
  return (
    <InlineItemEditor
      item={item}
      focus={focus}
      color={color}
      bucketId={bucket.id}
      members={members}
      statuses={DEFAULT_BUCKET_STATUSES}
      fields={parseFields(bucket.fieldSchema)}
      bucketReminders={bucket.defaultReminders}
      draggable={false}
      onCommit={onCommit}
      onExit={onExit}
    />
  );
}
