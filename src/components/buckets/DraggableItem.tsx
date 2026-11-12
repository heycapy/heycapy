import type { RefObject } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ItemRow, type ItemAssignee } from "./ItemRow";
import { PressableRow } from "./PressableRow";
import type { MenuAt } from "./ItemMenu";
import { reorderItemsAction } from "@/app/(app)/actions";
import type { ListItem, ReminderBadge } from "@/lib/reminders/status";
import type { StatusDef, FieldDef } from "@/types/rules";

type Item = ListItem;

type DraggableItemProps = {
  item: Item;
  statuses: StatusDef[];
  fields: FieldDef[];
  orderedItemsRef: RefObject<Item[]>;
  isEditing?: boolean;
  menuOpen?: boolean;
  onEditStart?: () => void;
  onStatusChange?: (status: string) => Promise<boolean>;
  onMenu: (at: MenuAt) => void;
  reminderBadge?: ReminderBadge;
  assignees?: ItemAssignee[];
  otherClock?: string;
  color: string;
  shared: boolean;
  tickedBy?: string;
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
  onMenu,
  reminderBadge,
  assignees,
  otherClock,
  color,
  shared,
  tickedBy,
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
      <PressableRow onMenu={onMenu}>
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
          assignees={assignees}
          otherClock={otherClock}
          color={color}
          shared={shared}
          tickedBy={tickedBy}
          onMenu={onMenu}
        />
      </PressableRow>
    </Reorder.Item>
  );
}
