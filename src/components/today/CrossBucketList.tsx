import { useState } from "react";
import { notify } from "@/components/ui/notify";
import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import { ItemRow } from "@/components/buckets/ItemRow";
import { itemAssignee } from "@/components/buckets/assignee";
import { parseFields } from "@/components/buckets/fields";
import { DEFAULT_BUCKET_STATUSES } from "@/components/buckets/constants";
import { bucketColor } from "@/components/buckets/bucket-color";
import { deleteItemAction, moveItemAction, updateItemAction } from "@/app/(app)/actions";
import { ItemMenu, type MenuAt } from "@/components/buckets/ItemMenu";
import { PressableRow } from "@/components/buckets/PressableRow";
import { completionToggle } from "@/components/buckets/completion";
import { offerUndoDelete } from "@/components/buckets/undoDelete";
import { isTick, offerUndoTick } from "@/components/buckets/undoTick";
import { deadlineValue } from "@/lib/time";
import type { CrossBucketItems } from "@/lib/items/today";
import type { ListItem } from "@/lib/reminders/status";

type Item = ListItem;

export type CrossBucketSection = { label: string; items: Item[] };

const HINT = "text-muted-foreground font-ui text-xs";

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
  const framed = useLookParts().listFrame === "framed";
  const statuses = DEFAULT_BUCKET_STATUSES;
  const showDue = sections.some((section) => section.items.some((item) => item.deadline));
  const bucketOf = (item: Item) => data?.buckets.find((b) => b.id === item.bucketId);

  async function changeStatus(item: Item, status: string) {
    const result = await updateItemAction(
      item.id,
      item.title,
      item.deadline ? deadlineValue(item.deadline, item.deadlineTimezone) : null,
      status
    );
    if (!result.ok) notify.error(result.error);
    await onChanged();
    if (result.ok && isTick(item, status)) {
      offerUndoTick(item, () => changeStatus(item, item.status));
    }
    return result.ok;
  }

  async function moveItem(item: Item, deadline: string) {
    const result = await moveItemAction(item.id, deadline);
    if (!result.ok) notify.error(result.error);
    await onChanged();
  }

  async function deleteItem(item: Item) {
    await deleteItemAction(item.id);
    await onChanged();
    offerUndoDelete(item.id, item.title, onChanged);
  }

  const menuItem: ListItem | undefined = menu?.item;

  function row(item: Item) {
    const bucket = bucketOf(item);
    const readonly = bucket?.readonly === true;
    const color = bucket && bucketColor(bucket.index);
    const assignees = data?.assignees[item.id];
    return (
      <PressableRow key={item.id} onMenu={(at) => setMenu({ item, at })}>
        <ItemRow
          item={item}
          statuses={statuses}
          fields={bucket ? parseFields(bucket.fieldSchema) : []}
          isEditing={editingItemId === item.id}
          menuOpen={menu?.item.id === item.id}
          onEditStart={readonly ? undefined : () => onEdit(item)}
          onStatusChange={readonly ? undefined : (status) => changeStatus(item, status)}
          reminderBadge={data?.reminderBadges[item.id]}
          assignees={assignees?.map(itemAssignee)}
          onMenu={(at) => setMenu({ item, at })}
          showDue={showDue}
          color={color}
          bucket={
            bucket && {
              name: bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name,
              color: color ?? "",
            }
          }
        />
      </PressableRow>
    );
  }

  return (
    <div
      className={cn(
        "@container overflow-hidden sm:mx-4",
        (framed || boxed) &&
          "border-border border-b-frame sm:border-x-frame sm:shadow-raised-sm sm:rounded-b-panel",
        boxed && "border-x-frame border-t-frame shadow-raised-sm rounded-panel mx-4"
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
            <div>{section.items.map(row)}</div>
          </section>
        ))
      )}
      {menu && (
        <ItemMenu
          item={menu.item}
          at={menu.at}
          readonly={bucketOf(menu.item)?.readonly === true}
          reminderBadge={data?.reminderBadges[menu.item.id]}
          nextReminderAt={menuItem?.nextReminderAt}
          completeLabel={completionToggle(menu.item.status, statuses).label}
          onComplete={() =>
            void changeStatus(menu.item, completionToggle(menu.item.status, statuses).next)
          }
          onMove={(deadline) => moveItem(menu.item, deadline)}
          onDelete={() => void deleteItem(menu.item)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
