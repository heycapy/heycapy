"use client";

import type { RefObject } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ItemRow } from "./ItemRow";
import { SwipeableRow } from "./SwipeableRow";
import { reorderItemsAction } from "@/app/(app)/actions";
import type { ReminderBadge } from "@/lib/reminders/status";
import type { items } from "@/lib/db/schema";
import type { StatusDef, FieldDef } from "@/types/rules";

type Item = typeof items.$inferSelect;

interface DraggableItemProps {
  item: Item;
  statuses: StatusDef[];
  fields: FieldDef[];
  orderedItemsRef: RefObject<Item[]>;
  isEditing?: boolean;
  onEditStart?: () => void;
  onStatusChange?: (status: string) => void;
  onDelete?: () => void;
  reminderBadge?: ReminderBadge;
}

export function DraggableItem({
  item,
  statuses,
  fields,
  orderedItemsRef,
  isEditing,
  onEditStart,
  onStatusChange,
  onDelete,
  reminderBadge,
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
      <SwipeableRow onDelete={onDelete ?? (() => undefined)} disabled={!onDelete}>
        <ItemRow
          item={item}
          statuses={statuses}
          fields={fields}
          dragControls={controls}
          isEditing={isEditing}
          onEditStart={onEditStart}
          onStatusChange={onStatusChange}
          reminderBadge={reminderBadge}
        />
      </SwipeableRow>
    </Reorder.Item>
  );
}
