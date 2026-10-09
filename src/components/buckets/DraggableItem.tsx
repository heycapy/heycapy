import type { RefObject } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ItemRow } from "./ItemRow";
import { SwipeableRow } from "./SwipeableRow";
import type { MenuAt } from "./ItemMenu";
import { completionToggle } from "./completion";
import { reorderItemsAction } from "@/app/(app)/actions";
import type { ReminderBadge } from "@/lib/reminders/status";
import type { items } from "@/lib/db/schema";
import type { StatusDef, FieldDef } from "@/types/rules";

type Item = typeof items.$inferSelect;

type DraggableItemProps = {
  item: Item;
  statuses: StatusDef[];
  fields: FieldDef[];
  orderedItemsRef: RefObject<Item[]>;
  isEditing?: boolean;
  menuOpen?: boolean;
  onEditStart?: () => void;
  onStatusChange?: (status: string) => void;
  onDelete?: () => void;
  onMenu: (at: MenuAt) => void;
  reminderBadge?: ReminderBadge;
  assignee?: string;
};

export function DraggableItem({
  item,
  statuses,
  fields,
  orderedItemsRef,
  isEditing,
  menuOpen,
  onEditStart,
  onStatusChange,
  onDelete,
  onMenu,
  reminderBadge,
  assignee,
}: DraggableItemProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragControls={controls}
      dragListener={false}
      onDragEnd={async () => {
        await reorderItemsAction(
          item.bucketId,
          orderedItemsRef.current.map((i) => i.id)
        );
      }}
      className="list-none"
    >
      <SwipeableRow
        onDelete={onDelete ?? (() => undefined)}
        onComplete={
          onStatusChange
            ? () => onStatusChange(completionToggle(item.status, statuses).next)
            : undefined
        }
        completeLabel={completionToggle(item.status, statuses).label}
        disabled={!onDelete}
        onMenu={onMenu}
      >
        <ItemRow
          item={item}
          statuses={statuses}
          fields={fields}
          dragControls={controls}
          isEditing={isEditing}
          menuOpen={menuOpen}
          onEditStart={onEditStart}
          onStatusChange={onStatusChange}
          reminderBadge={reminderBadge}
          assignee={assignee}
          onMenu={onMenu}
        />
      </SwipeableRow>
    </Reorder.Item>
  );
}
