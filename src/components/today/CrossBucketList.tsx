import { cn } from "@/lib/utils";
import { ItemRow } from "@/components/buckets/ItemRow";
import { parseFields } from "@/components/buckets/fields";
import { BUCKET_PALETTE, DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { updateItemAction } from "@/app/(app)/actions";
import type { CrossBucketItems } from "@/lib/items/today";
import type { items } from "@/lib/db/schema";

type Item = typeof items.$inferSelect;

export type CrossBucketSection = { label: string; items: Item[] };

const HINT = "text-muted-foreground font-mono text-xs";

type CrossBucketListProps = {
  data: CrossBucketItems | null;
  sections: CrossBucketSection[];
  emptyText: string;
  editingItemId: number | null;
  onEdit: (item: Item) => void;
  onChanged: () => Promise<void>;
};

export function CrossBucketList({
  data,
  sections,
  emptyText,
  editingItemId,
  onEdit,
  onChanged,
}: CrossBucketListProps) {
  const statuses = DEFAULT_BUCKET_STATUSES;
  const bucketOf = (item: Item) => data?.buckets.find((b) => b.id === item.bucketId);

  async function changeStatus(item: Item, status: string) {
    await updateItemAction(
      item.id,
      item.title,
      item.deadline ? item.deadline.toISOString() : null,
      status
    );
    await onChanged();
  }

  function row(item: Item) {
    const bucket = bucketOf(item);
    return (
      <ItemRow
        key={item.id}
        item={item}
        statuses={statuses}
        fields={bucket ? parseFields(bucket.fieldSchema) : []}
        isEditing={editingItemId === item.id}
        onEditStart={() => onEdit(item)}
        onStatusChange={(status) => void changeStatus(item, status)}
        reminderBadge={data?.reminderBadges[item.id]}
        bucket={
          bucket && {
            name: bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name,
            color: BUCKET_PALETTE[bucket.index % BUCKET_PALETTE.length] ?? "",
          }
        }
      />
    );
  }

  return (
    <div className="border-border overflow-hidden border-y-2 sm:mx-4 sm:border-x-2 sm:shadow-[2px_2px_0_var(--border)]">
      {!data ? (
        <p className={cn(HINT, "px-4 py-6 text-center")}>loading...</p>
      ) : sections.length === 0 ? (
        <p className={cn(HINT, "px-4 py-6 text-center")}>{emptyText}</p>
      ) : (
        sections.map((section) => (
          <section key={section.label} aria-label={section.label}>
            <p
              className={cn(
                HINT,
                "bg-card border-border border-b px-3 py-1.5",
                section.label === "overdue" && "text-destructive"
              )}
            >
              {section.label}
            </p>
            <div className="divide-border divide-y divide-dashed">{section.items.map(row)}</div>
          </section>
        ))
      )}
    </div>
  );
}
