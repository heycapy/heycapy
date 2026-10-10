import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ItemRow } from "@/components/buckets/ItemRow";
import { parseFields } from "@/components/buckets/fields";
import { BUCKET_PALETTE, DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { deleteItemAction, moveItemAction, updateItemAction } from "@/app/(app)/actions";
import { ItemMenu, type MenuAt } from "@/components/buckets/ItemMenu";
import { SwipeableRow } from "@/components/buckets/SwipeableRow";
import { completionToggle } from "@/components/buckets/completion";
import { offerUndoDelete } from "@/components/buckets/undoDelete";
import { deadlineValue } from "@/lib/time";
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
  boxed?: boolean;
};

export function CrossBucketList({
  data,
  sections,
  emptyText,
  editingItemId,
  onEdit,
  onChanged,
  boxed = false,
}: CrossBucketListProps) {
  const [menu, setMenu] = useState<{ item: Item; at: MenuAt } | null>(null);
  const statuses = DEFAULT_BUCKET_STATUSES;
  const bucketOf = (item: Item) => data?.buckets.find((b) => b.id === item.bucketId);

  async function changeStatus(item: Item, status: string) {
    await updateItemAction(
      item.id,
      item.title,
      item.deadline ? deadlineValue(item.deadline, item.deadlineTimezone) : null,
      status
    );
    await onChanged();
  }

  async function moveItem(item: Item, deadline: string) {
    const result = await moveItemAction(item.id, deadline);
    if (!result.ok) toast.error(result.error);
    await onChanged();
  }

  async function deleteItem(item: Item) {
    await deleteItemAction(item.id);
    await onChanged();
    offerUndoDelete(item.id, item.title, onChanged);
  }

  function row(item: Item) {
    const bucket = bucketOf(item);
    const readonly = bucket?.readonly === true;
    const toggle = completionToggle(item.status, statuses);
    return (
      <SwipeableRow
        key={item.id}
        onDelete={() => void deleteItem(item)}
        onComplete={() => void changeStatus(item, toggle.next)}
        completeLabel={toggle.label}
        disabled={readonly}
        onMenu={(at) => setMenu({ item, at })}
      >
        <ItemRow
          item={item}
          statuses={statuses}
          fields={bucket ? parseFields(bucket.fieldSchema) : []}
          isEditing={editingItemId === item.id}
          menuOpen={menu?.item.id === item.id}
          onEditStart={readonly ? undefined : () => onEdit(item)}
          onStatusChange={readonly ? undefined : (status) => void changeStatus(item, status)}
          reminderBadge={data?.reminderBadges[item.id]}
          onMenu={(at) => setMenu({ item, at })}
          bucket={
            bucket && {
              name: bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name,
              color: BUCKET_PALETTE[bucket.index % BUCKET_PALETTE.length] ?? "",
            }
          }
        />
      </SwipeableRow>
    );
  }

  return (
    <div
      className={cn(
        "border-border overflow-hidden border-y-2 sm:mx-4 sm:border-x-2 sm:shadow-[2px_2px_0_var(--border)]",
        boxed && "mx-4 border-x-2 shadow-[2px_2px_0_var(--border)]"
      )}
    >
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
      {menu && (
        <ItemMenu
          item={menu.item}
          at={menu.at}
          readonly={bucketOf(menu.item)?.readonly === true}
          onMove={(deadline) => moveItem(menu.item, deadline)}
          onDelete={() => void deleteItem(menu.item)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
