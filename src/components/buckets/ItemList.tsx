import type { ItemId } from "@/types/ids";
import { useState, type RefObject } from "react";
import { Reorder } from "framer-motion";
import { ItemRow, type ItemAssignee } from "./ItemRow";
import { itemAssignee } from "./assignee";
import { PressableRow } from "./PressableRow";
import { completionToggle } from "./completion";
import { DraggableItem } from "./DraggableItem";
import { ItemMenu, type MenuAt } from "./ItemMenu";
import { InlineItemEditor } from "./InlineItemEditor";
import type { OpenFocus } from "./constants";
import { useOpenItem } from "./useOpenItem";
import type { ItemPatch } from "@/lib/items/edit-draft";
import type { ListItem, ReminderBadge } from "@/lib/reminders/status";
import type { StatusDef, FieldDef } from "@/types/rules";
import type { BucketMember } from "@/lib/buckets/members";
import { memberName } from "@/lib/buckets/member-name";
import { ITEM_STATUS } from "@/constants";
import { otherClock } from "@/lib/timezones/gap";
import { itemDeadline } from "@/lib/time";

type Item = ListItem;

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
  bucketId: number;
  bucketReminders: number[];
  reminderBadges: Record<ItemId, ReminderBadge>;
  members: BucketMember[];
  shared: boolean;
  onAssign: (item: Item, assigneeIds: number[]) => Promise<boolean>;
  onReorder: (items: Item[]) => void;
  onPatch: (item: Item, patch: ItemPatch) => void;
  onStatusChange: (item: Item, status: string) => Promise<boolean>;
  onMove: (item: Item, deadline: string) => Promise<void>;
  onDelete: (itemId: ItemId) => void;
};

export function ItemList({
  loading,
  items,
  emptyText,
  orderedItemsRef,
  draggable,
  readonly,
  statuses,
  fields,
  color,
  bucketId,
  bucketReminders,
  reminderBadges,
  members,
  shared,
  onAssign,
  onReorder,
  onPatch,
  onStatusChange,
  onMove,
  onDelete,
}: ItemListProps) {
  const [menu, setMenu] = useState<{ item: Item; at: MenuAt } | null>(null);
  const { openId, focus, open, close } = useOpenItem();

  if (loading || items.length === 0) {
    return (
      <p className="text-muted-foreground font-ui px-4 py-6 text-center text-xs">
        {loading
          ? "loading..."
          : (emptyText ?? (readonly ? "no items yet" : "no items yet · type one below"))}
      </p>
    );
  }

  const yours = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clockHint = (item: Item) => {
    const due = item.deadline && itemDeadline(item.deadline, item.deadlineTimezone);
    if (!due || due.allDay) return undefined;
    const [only] = item.assigneeIds.length === 1 ? item.assigneeIds : [];
    const assignee = members.find((m) => m.userId === only);
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

  const assigneesOf = (item: ListItem): ItemAssignee[] =>
    !shared ? [] : members.filter((m) => item.assigneeIds.includes(m.userId)).map(itemAssignee);

  const tickedBy = (item: Item) => {
    if (!shared || item.status !== ITEM_STATUS.completed) return undefined;
    const member = members.find((m) => m.userId === item.completedBy);
    return member && (member.isYou ? "you" : memberName(member));
  };

  const rowProps = (item: Item) => ({
    item,
    statuses,
    fields,
    menuOpen: menu?.item.id === item.id,
    onEditStart: readonly || openId !== null ? undefined : (at: OpenFocus) => open(item.id, at),
    onStatusChange: readonly ? undefined : (s: string) => onStatusChange(item, s),
    reminderBadge: reminderBadges[item.id],
    assignees: assigneesOf(item),
    otherClock: clockHint(item),
    color,
    shared,
    tickedBy: tickedBy(item),
    onMenu: (at: MenuAt) => setMenu({ item, at }),
  });

  const editorFor = (item: Item) =>
    openId === item.id ? (
      <InlineItemEditor
        item={item}
        focus={focus}
        color={color}
        bucketId={bucketId}
        members={members}
        statuses={statuses}
        fields={fields}
        bucketReminders={bucketReminders}
        draggable={draggable}
        onCommit={(patch) => onPatch(item, patch)}
        onExit={(focusRow) => close(item.id, focusRow)}
      />
    ) : undefined;

  const menuItem: ListItem | undefined = menu?.item;
  const menuElement = menu && (
    <ItemMenu
      item={menu.item}
      at={menu.at}
      readonly={readonly}
      reminderBadge={reminderBadges[menu.item.id]}
      nextReminderAt={menuItem?.nextReminderAt}
      assign={shared ? { members, onAssign: (userIds) => onAssign(menu.item, userIds) } : undefined}
      completeLabel={completionToggle(menu.item.status, statuses).label}
      onComplete={() =>
        void onStatusChange(menu.item, completionToggle(menu.item.status, statuses).next)
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
          data-item-list
          className="m-0 list-none p-0"
        >
          {items.map((item) => (
            <DraggableItem
              key={item.id}
              {...rowProps(item)}
              dimmed={openId !== null}
              editor={editorFor(item)}
              orderedItemsRef={orderedItemsRef}
            />
          ))}
        </Reorder.Group>
        {menuElement}
      </>
    );
  }

  return (
    <div data-item-list>
      {items.map((item) =>
        openId === item.id ? (
          <div key={item.id}>{editorFor(item)}</div>
        ) : (
          <PressableRow
            key={item.id}
            dimmed={openId !== null}
            onMenu={(at) => setMenu({ item, at })}
          >
            <ItemRow {...rowProps(item)} />
          </PressableRow>
        )
      )}
      {menuElement}
    </div>
  );
}
