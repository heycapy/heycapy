"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ItemRow } from "./ItemRow";
import { SwipeableRow } from "./SwipeableRow";
import { ItemDialog } from "./ItemDialog";
import { BucketSettings } from "./BucketSettings";
import type { SettingsTab } from "./BucketSettingsForm";
import { RemindersOffNotice } from "./RemindersOffNotice";
import type { ReminderBadge } from "@/lib/reminders/status";
import { BracketButton } from "@/components/ui/BracketButton";
import { daysToDisplayStr, parseDurationToDate } from "@/lib/duration";
import type { ItemStatus, ItemsRulesConfig } from "./constants";
import { DEFAULT_BUCKET_STATUSES } from "./constants";
import {
  addItemAction,
  updateItemAction,
  deleteItemAction,
  skipOccurrenceAction,
  reorderItemsAction,
  getItemsForBucketAction,
} from "@/app/(app)/actions";
import type { buckets, items as itemsTable } from "@/lib/db/schema";
import type { DragControls } from "framer-motion";
import { BucketSchema } from "@/types/rules";
import { nextOccurrenceDate, parseRecurring } from "@/lib/items/occurrence";
import type { RecurringConfig, StatusDef, FieldDef } from "@/types/rules";
import { useUIStore } from "@/store/ui";

type BucketRow = typeof buckets.$inferSelect;
type Item = typeof itemsTable.$inferSelect;

interface BucketContentProps {
  bucket: BucketRow;
  accentColor: string;
}

function toLocalDatetimeStr(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return `${y}-${mo}-${dy}`;
  return `${y}-${mo}-${dy}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function DraggableItem({
  item,
  statuses,
  fields,
  orderedItemsRef,
  isEditing,
  onEditStart,
  onStatusChange,
  onDelete,
  reminderBadge,
}: {
  item: Item;
  statuses: StatusDef[];
  fields: FieldDef[];
  orderedItemsRef: React.RefObject<Item[]>;
  isEditing?: boolean;
  onEditStart?: () => void;
  onStatusChange?: (status: string) => void;
  onDelete?: () => void;
  dragControls?: DragControls;
  reminderBadge?: ReminderBadge;
}) {
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

export function BucketContent({ bucket, accentColor }: BucketContentProps) {
  const aiRefreshTick = useUIStore((s) => s.aiRefreshTick);

  const rules: ItemsRulesConfig = (() => {
    try {
      return JSON.parse(bucket.itemsRules) as ItemsRulesConfig;
    } catch {
      return {};
    }
  })();

  const bucketStatuses = DEFAULT_BUCKET_STATUSES;
  const bucketFields = (() => {
    try {
      if (!bucket.fieldSchema) return [] as FieldDef[];
      const raw = bucket.fieldSchema as unknown as string;
      const parsed = BucketSchema.parse(typeof raw === "string" ? JSON.parse(raw) : raw);
      return parsed.fields;
    } catch {
      return [] as FieldDef[];
    }
  })();

  const defaultStatus =
    bucketStatuses.find((s) => s.isDefault)?.name ?? bucketStatuses[0]?.name ?? "active";

  const isDraggable = rules.drag === true && rules.sortBy === "manual";
  const showCompleted = rules.showCompleted !== false;

  const [fetchedItems, setFetchedItems] = useState<Item[]>([]);
  const [reminderBadges, setReminderBadges] = useState<Record<number, ReminderBadge>>({});
  const [loadingItems, setLoadingItems] = useState(true);
  const [orderedItems, setOrderedItems] = useState<Item[]>([]);
  const orderedItemsRef = useRef<Item[]>([]);

  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDeadline, setAddDeadline] = useState("");
  const [addStatus, setAddStatus] = useState<ItemStatus>(defaultStatus);
  const [addRecurring, setAddRecurring] = useState<RecurringConfig | null>(null);
  const [addProperties, setAddProperties] = useState<Record<string, unknown>>({});
  const [addError, setAddError] = useState("");
  const [addPending, startAddTransition] = useTransition();

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState<ItemStatus>(defaultStatus);
  const [editRecurring, setEditRecurring] = useState<RecurringConfig | null>(null);
  const [editProperties, setEditProperties] = useState<Record<string, unknown>>({});
  const [editPending, startEditTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getItemsForBucketAction(bucket.id).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setFetchedItems(result.items);
        setReminderBadges(result.reminderBadges);
      }
      setLoadingItems(false);
    });
    return () => {
      cancelled = true;
    };
  }, [bucket.id, bucket.itemsRules, aiRefreshTick]);

  useEffect(() => {
    const next = showCompleted
      ? fetchedItems
      : fetchedItems.filter((i) => i.status !== "completed");
    const id = setTimeout(() => {
      setOrderedItems(next);
      orderedItemsRef.current = next;
    }, 0);
    return () => clearTimeout(id);
  }, [fetchedItems, showCompleted]);

  async function refetchItems() {
    const result = await getItemsForBucketAction(bucket.id);
    if (!result.ok) return;
    setFetchedItems(result.items);
    setReminderBadges(result.reminderBadges);
  }

  async function handleStatusChange(item: Item, status: string) {
    await updateItemAction(
      item.id,
      item.title,
      item.deadline ? item.deadline.toISOString() : null,
      status
    );
    await refetchItems();
  }

  function startEditing(item: Item) {
    setAddingItem(false);
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditDeadline(item.deadline ? toLocalDatetimeStr(item.deadline) : "");
    setEditStatus((item.status as ItemStatus) || defaultStatus);
    setEditRecurring(parseRecurring(item.recurring));
    setEditProperties(
      item.properties ? (JSON.parse(item.properties) as Record<string, unknown>) : {}
    );
  }

  function cancelEditing() {
    setEditingItemId(null);
    setEditTitle("");
    setEditDeadline("");
    setEditStatus(defaultStatus);
    setEditRecurring(null);
    setEditProperties({});
  }

  function cancelAdding() {
    setAddingItem(false);
    setAddTitle("");
    setAddDeadline("");
    setAddStatus(defaultStatus);
    setAddRecurring(null);
    setAddProperties({});
    setAddError("");
  }

  function handleAdd() {
    if (!addTitle.trim() || addPending) return;
    setAddError("");
    startAddTransition(async () => {
      const result = await addItemAction(
        bucket.id,
        addTitle,
        addDeadline || null,
        addStatus,
        addRecurring,
        Object.keys(addProperties).length > 0 ? addProperties : null
      );
      if (result.ok) {
        cancelAdding();
        await refetchItems();
      } else {
        setAddError(result.error);
      }
    });
  }

  function handleUpdate() {
    if (!editingItemId || !editTitle.trim() || editPending) return;
    startEditTransition(async () => {
      const result = await updateItemAction(
        editingItemId,
        editTitle,
        editDeadline || null,
        editStatus,
        editRecurring,
        Object.keys(editProperties).length > 0 ? editProperties : null
      );
      if (result.ok) {
        cancelEditing();
        await refetchItems();
      }
    });
  }

  function handleDelete() {
    if (!editingItemId || editPending) return;
    startEditTransition(async () => {
      await deleteItemAction(editingItemId);
      cancelEditing();
      await refetchItems();
    });
  }

  function handleSkip() {
    if (!editingItemId || editPending) return;
    startEditTransition(async () => {
      const result = await skipOccurrenceAction(editingItemId);
      if (result.ok) {
        cancelEditing();
        await refetchItems();
      }
    });
  }

  async function handleSwipeDelete(itemId: number) {
    await deleteItemAction(itemId);
    await refetchItems();
  }

  function handleReorder(newOrder: Item[]) {
    orderedItemsRef.current = newOrder;
    setOrderedItems(newOrder);
  }

  const isDialogOpen = addingItem || editingItemId !== null;
  const editingItem = fetchedItems.find((i) => i.id === editingItemId);
  const editingRecurring = parseRecurring(editingItem?.recurring ?? null);
  const canSkipEditing =
    editingItem?.status !== "completed" &&
    !!editingItem?.deadline &&
    !!editingRecurring &&
    nextOccurrenceDate(editingItem.deadline, editingRecurring) !== null;
  const isReadonly = rules.readonly === true;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span
            className="h-3.5 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span className="font-pixel min-w-0 truncate overflow-hidden text-sm leading-snug">
            {bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name}
          </span>
          <span className="text-muted-foreground/40 shrink-0 font-mono text-[10px]">
            #{bucket.id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <BracketButton onClick={() => setSettingsTab("items")} className="px-1 py-1.5">
            settings
          </BracketButton>
          {!isReadonly && (
            <BracketButton
              onClick={() => {
                cancelEditing();
                setAddDeadline(
                  rules.defaultDeadlineOffsetDays !== null &&
                    rules.defaultDeadlineOffsetDays !== undefined
                    ? (parseDurationToDate(daysToDisplayStr(rules.defaultDeadlineOffsetDays)) ?? "")
                    : ""
                );
                setAddingItem(true);
              }}
              className="px-1 py-1.5"
            >
              add +
            </BracketButton>
          )}
        </div>
      </div>

      <RemindersOffNotice
        notificationsRules={bucket.notificationsRules}
        hasDatedItems={fetchedItems.some((i) => i.deadline && i.status !== "completed")}
        onSetUp={() => setSettingsTab("notifications")}
      />

      <div
        className="border-border mx-4 overflow-hidden border-2"
        style={{ boxShadow: "2px 2px 0 var(--border)" }}
      >
        {loadingItems ? (
          <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
            loading...
          </p>
        ) : orderedItems.length === 0 ? (
          <p className="text-muted-foreground px-4 py-6 text-center font-mono text-xs">
            no items yet · press + to add one
          </p>
        ) : isDraggable ? (
          <Reorder.Group
            axis="y"
            values={orderedItems}
            onReorder={handleReorder}
            className="divide-border/50 m-0 list-none divide-y divide-dotted p-0"
          >
            {orderedItems.map((item) => (
              <DraggableItem
                key={item.id}
                item={item}
                statuses={bucketStatuses}
                fields={bucketFields}
                orderedItemsRef={orderedItemsRef}
                isEditing={editingItemId === item.id}
                onEditStart={isReadonly ? undefined : () => startEditing(item)}
                onStatusChange={isReadonly ? undefined : (s) => handleStatusChange(item, s)}
                reminderBadge={reminderBadges[item.id]}
                onDelete={isReadonly ? undefined : () => void handleSwipeDelete(item.id)}
              />
            ))}
          </Reorder.Group>
        ) : (
          <div className="divide-border/50 divide-y divide-dotted">
            {orderedItems.map((item) => (
              <SwipeableRow
                key={item.id}
                onDelete={() => void handleSwipeDelete(item.id)}
                disabled={isReadonly}
              >
                <ItemRow
                  item={item}
                  statuses={bucketStatuses}
                  fields={bucketFields}
                  isEditing={editingItemId === item.id}
                  onEditStart={isReadonly ? undefined : () => startEditing(item)}
                  onStatusChange={isReadonly ? undefined : (s) => handleStatusChange(item, s)}
                  reminderBadge={reminderBadges[item.id]}
                />
              </SwipeableRow>
            ))}
          </div>
        )}
      </div>

      <ItemDialog
        open={isDialogOpen}
        mode={addingItem ? "add" : "edit"}
        title={addingItem ? addTitle : editTitle}
        deadline={addingItem ? addDeadline : editDeadline}
        status={addingItem ? addStatus : editStatus}
        statuses={bucketStatuses}
        fields={bucketFields.length > 0 ? bucketFields : undefined}
        properties={addingItem ? addProperties : editProperties}
        recurring={addingItem ? addRecurring : editRecurring}
        error={addingItem ? addError : undefined}
        pending={addingItem ? addPending : editPending}
        onTitleChange={addingItem ? setAddTitle : setEditTitle}
        onDeadlineChange={addingItem ? setAddDeadline : setEditDeadline}
        onStatusChange={addingItem ? setAddStatus : setEditStatus}
        onPropertiesChange={addingItem ? setAddProperties : setEditProperties}
        onRecurringChange={addingItem ? setAddRecurring : setEditRecurring}
        onConfirm={addingItem ? handleAdd : handleUpdate}
        onCancel={addingItem ? cancelAdding : cancelEditing}
        onDelete={editingItemId !== null ? handleDelete : undefined}
        onSkip={canSkipEditing ? handleSkip : undefined}
      />

      <BucketSettings
        open={settingsTab !== null}
        initialTab={settingsTab ?? undefined}
        bucket={bucket}
        onClose={() => setSettingsTab(null)}
      />
    </div>
  );
}
