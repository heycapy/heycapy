import type { RefObject } from "react";
import { Reorder } from "framer-motion";
import { ItemRow } from "./ItemRow";
import { SwipeableRow } from "./SwipeableRow";
import { completionToggle } from "./completion";
import { DraggableItem } from "./DraggableItem";
import type { ReminderBadge } from "@/lib/reminders/status";
import type { items } from "@/lib/db/schema";
import type { StatusDef, FieldDef } from "@/types/rules";

type Item = typeof items.$inferSelect;

type ItemListProps = {
  loading: boolean;
  items: Item[];
  orderedItemsRef: RefObject<Item[]>;
  draggable: boolean;
  readonly: boolean;
  statuses: StatusDef[];
  fields: FieldDef[];
  editingItemId: number | null;
  reminderBadges: Record<number, ReminderBadge>;
  onReorder: (items: Item[]) => void;
  onEdit: (item: Item) => void;
  onStatusChange: (item: Item, status: string) => void;
  onDelete: (itemId: number) => void;
};

export function ItemList({
  loading,
  items,
  orderedItemsRef,
  draggable,
  readonly,
  statuses,
  fields,
  editingItemId,
  reminderBadges,
  onReorder,
  onEdit,
  onStatusChange,
  onDelete,
}: ItemListProps) {
  if (loading || items.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
        {loading ? "loading..." : "no items yet · press + to add one"}
      </p>
    );
  }

  const rowProps = (item: Item) => ({
    item,
    statuses,
    fields,
    isEditing: editingItemId === item.id,
    onEditStart: readonly ? undefined : () => onEdit(item),
    onStatusChange: readonly ? undefined : (s: string) => onStatusChange(item, s),
    reminderBadge: reminderBadges[item.id],
  });

  if (draggable) {
    return (
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={onReorder}
        className="divide-border/50 m-0 list-none divide-y divide-dotted p-0"
      >
        {items.map((item) => (
          <DraggableItem
            key={item.id}
            {...rowProps(item)}
            orderedItemsRef={orderedItemsRef}
            onDelete={readonly ? undefined : () => onDelete(item.id)}
          />
        ))}
      </Reorder.Group>
    );
  }

  return (
    <div className="divide-border/50 divide-y divide-dotted">
      {items.map((item) => (
        <SwipeableRow
          key={item.id}
          onDelete={() => onDelete(item.id)}
          onComplete={() => onStatusChange(item, completionToggle(item.status, statuses).next)}
          completeLabel={completionToggle(item.status, statuses).label}
          disabled={readonly}
        >
          <ItemRow {...rowProps(item)} />
        </SwipeableRow>
      ))}
    </div>
  );
}
