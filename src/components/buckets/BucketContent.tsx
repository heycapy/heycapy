"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { ItemRow } from "./ItemRow";
import { ItemDialog } from "./ItemDialog";
import { BucketSettings } from "./BucketSettings";
import { BracketButton } from "@/components/ui/BracketButton";
import { daysToDisplayStr, parseDurationToDate } from "@/lib/duration";
import type { ItemStatus, ItemsRulesConfig } from "./constants";
import { DEFAULT_BUCKET_STATUSES } from "./constants";
import {
  addItemAction,
  updateItemAction,
  deleteItemAction,
  reorderItemsAction,
  getItemsForBucketAction,
} from "@/app/(app)/actions";
import type { buckets, items as itemsTable } from "@/lib/db/schema";
import type { DragControls } from "framer-motion";
import { BucketSchema, RecurringConfig as RecurringConfigSchema } from "@/types/rules";
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

function parseRecurring(raw: string | null): RecurringConfig | null {
  if (!raw) return null;
  try {
    return RecurringConfigSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function DraggableItem({
  item,
  statuses,
  fields,
  orderedItemsRef,
  isEditing,
  onEditStart,
  onStatusChange,
}: {
  item: Item;
  statuses: StatusDef[];
  fields: FieldDef[];
  orderedItemsRef: React.RefObject<Item[]>;
  isEditing?: boolean;
  onEditStart?: () => void;
  onStatusChange?: (status: string) => void;
  dragControls?: DragControls;
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
      <ItemRow
        item={item}
        statuses={statuses}
        fields={fields}
        dragControls={controls}
        isEditing={isEditing}
        onEditStart={onEditStart}
        onStatusChange={onStatusChange}
      />
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
  const [loadingItems, setLoadingItems] = useState(true);
  const [orderedItems, setOrderedItems] = useState<Item[]>([]);
  const orderedItemsRef = useRef<Item[]>([]);

  const [settingsOpen, setSettingsOpen] = useState(false);
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
      if (result.ok) setFetchedItems(result.items);
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
    if (result.ok) setFetchedItems(result.items);
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

  function handleReorder(newOrder: Item[]) {
    orderedItemsRef.current = newOrder;
    setOrderedItems(newOrder);
  }

  const isDialogOpen = addingItem || editingItemId !== null;
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
          <BracketButton onClick={() => setSettingsOpen(true)} className="px-1 py-1.5">
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
              />
            ))}
          </Reorder.Group>
        ) : (
          <div className="divide-border/50 divide-y divide-dotted">
            {orderedItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                statuses={bucketStatuses}
                fields={bucketFields}
                isEditing={editingItemId === item.id}
                onEditStart={isReadonly ? undefined : () => startEditing(item)}
                onStatusChange={isReadonly ? undefined : (s) => handleStatusChange(item, s)}
              />
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
      />

      <BucketSettings open={settingsOpen} bucket={bucket} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
