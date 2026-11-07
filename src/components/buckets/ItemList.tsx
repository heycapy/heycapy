import { useState, type RefObject } from "react";
import { Reorder } from "framer-motion";
import { ItemRow, type ItemAssignee } from "./ItemRow";
import { itemAssignee } from "./assignee";
import { PressableRow } from "./PressableRow";
import { completionToggle } from "./completion";
import { DraggableItem } from "./DraggableItem";
import { ItemMenu, type MenuAt } from "./ItemMenu";
import type { ListItem, ReminderBadge } from "@/lib/reminders/status";
import type { items } from "@/lib/db/schema";
import type { StatusDef, FieldDef } from "@/types/rules";
import type { BucketMember } from "@/lib/buckets/members";
import { memberName } from "@/lib/buckets/member-name";
import { ITEM_STATUS } from "@/constants";
import { otherClock } from "@/lib/timezones/gap";
import { itemDeadline } from "@/lib/time";

type Item = typeof items.$inferSelect;

type ItemListProps = {
  loading: boolean;
  items: Item[];
  emptyText?: string;
  orderedItemsRef: RefObject<Item[]>;
  draggable: boolean;
  readonly: boolean;
  statuses: StatusDef[];
  fields: FieldDef[];
  color: string;
  editingItemId: number | null;
  reminderBadges: Record<number, ReminderBadge>;
  members: BucketMember[];
  shared: boolean;
  onAssign: (item: Item, assigneeId: number | null) => Promise<boolean>;
  onReorder: (items: Item[]) => void;
  onEdit: (item: Item) => void;
  onStatusChange: (item: Item, status: string) => void;
  onMove: (item: Item, deadline: string) => Promise<void>;
  onDelete: (itemId: number) => void;
};

export function ItemList({
  loading,
  items,
  emptyText = "no items yet · press + to add one",
  orderedItemsRef,
  draggable,
  readonly,
  statuses,
  fields,
  color,
  editingItemId,
  reminderBadges,
  members,
  shared,
  onAssign,
  onReorder,
  onEdit,
  onStatusChange,
  onMove,
  onDelete,
}: ItemListProps) {
  const [menu, setMenu] = useState<{ item: Item; at: MenuAt } | null>(null);

  if (loading || items.length === 0) {
    return (
      <p className="text-muted-foreground font-ui px-4 py-6 text-center text-xs">
        {loading ? "loading..." : emptyText}
      </p>
    );
  }

  const yours = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clockHint = (item: Item) => {
    const due = item.deadline && itemDeadline(item.deadline, item.deadlineTimezone);
    if (!due || due.allDay) return undefined;
    const assignee = members.find((m) => m.userId === item.assigneeId);
    const setter = members.find((m) => m.timezone === item.deadlineTimezone && m.place);
    return (
      otherClock(
        due.at,
        yours,
        assignee && { ...assignee, name: memberName(assignee) },
        setter?.place ? { timezone: setter.timezone, place: setter.place } : undefined
      ) ?? undefined
    );
  };

  const assigneeOf = (item: Item): ItemAssignee | undefined => {
    const member = members.find((m) => m.userId === item.assigneeId);
    return member && itemAssignee(member);
  };

  const showDue = items.some((item) => item.deadline);
  const tickedBy = (item: Item) => {
    if (!shared || item.status !== ITEM_STATUS.completed) return undefined;
    const member = members.find((m) => m.userId === item.completedBy);
    return member && (member.isYou ? "you" : memberName(member));
  };

  const rowProps = (item: Item) => ({
    item,
    statuses,
    fields,
    isEditing: editingItemId === item.id,
    menuOpen: menu?.item.id === item.id,
    onEditStart: readonly ? undefined : () => onEdit(item),
    onStatusChange: readonly ? undefined : (s: string) => onStatusChange(item, s),
    reminderBadge: reminderBadges[item.id],
    assignee: assigneeOf(item),
    otherClock: clockHint(item),
    color,
    showDue,
    shared,
    tickedBy: tickedBy(item),
    onMenu: (at: MenuAt) => setMenu({ item, at }),
  });

  const menuItem: ListItem | undefined = menu?.item;
  const menuElement = menu && (
    <ItemMenu
      item={menu.item}
      at={menu.at}
      readonly={readonly}
      reminderBadge={reminderBadges[menu.item.id]}
      nextReminderAt={menuItem?.nextReminderAt}
      assign={shared ? { members, onAssign: (userId) => onAssign(menu.item, userId) } : undefined}
      completeLabel={completionToggle(menu.item.status, statuses).label}
      onComplete={() =>
        onStatusChange(menu.item, completionToggle(menu.item.status, statuses).next)
      }
      onMove={(deadline) => onMove(menu.item, deadline)}
      onDelete={() => onDelete(menu.item.id)}
      onClose={() => setMenu(null)}
    />
  );

  if (draggable) {
    return (
      <>
        <Reorder.Group
          axis="y"
          values={items}
          onReorder={onReorder}
          className="divide-border/50 divide-divider m-0 list-none divide-y p-0"
        >
          {items.map((item) => (
            <DraggableItem key={item.id} {...rowProps(item)} orderedItemsRef={orderedItemsRef} />
          ))}
        </Reorder.Group>
        {menuElement}
      </>
    );
  }

  return (
    <div className="divide-border/50 divide-divider divide-y">
      {items.map((item) => (
        <PressableRow key={item.id} onMenu={(at) => setMenu({ item, at })}>
          <ItemRow {...rowProps(item)} />
        </PressableRow>
      ))}
      {menuElement}
    </div>
  );
}
