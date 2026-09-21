"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Settings } from "lucide-react";
import { ItemRow } from "./ItemRow";
import { ItemDialog } from "./ItemDialog";
import { BucketSettings } from "./BucketSettings";
import { BracketButton } from "@/components/ui/BracketButton";
import { daysToDisplayStr, parseDurationToDate } from "@/lib/duration";
import type { ItemStatus, ItemsRulesConfig } from "./constants";
import {
  addItemAction,
  updateItemAction,
  deleteItemAction,
  reorderItemsAction,
  getItemsForBucketAction,
} from "@/app/(app)/actions";
import type { buckets, items as itemsTable } from "@/lib/db/schema";
import type { DragControls } from "framer-motion";
import { RecurringConfig as RecurringConfigSchema } from "@/types/rules";
import type { RecurringConfig } from "@/types/rules";
import { useUIStore } from "@/store/ui";

type BucketRow = typeof buckets.$inferSelect;
type Item = typeof itemsTable.$inferSelect;

interface BucketContentProps {
  bucket: BucketRow;
  accentColor: string;
}

function toDateInput(d: Date): string {
  return d.toISOString().split("T")[0];
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
  orderedItemsRef,
  isEditing,
  onEditStart,
  onStatusChange,
}: {
  item: Item;
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
  const [addStatus, setAddStatus] = useState<ItemStatus>("active");
  const [addRecurring, setAddRecurring] = useState<RecurringConfig | null>(null);
  const [addError, setAddError] = useState("");
  const [addPending, startAddTransition] = useTransition();

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState<ItemStatus>("active");
  const [editRecurring, setEditRecurring] = useState<RecurringConfig | null>(null);
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
      item.deadline ? toDateInput(item.deadline) : null,
      status
    );
    await refetchItems();
  }

  function startEditing(item: Item) {
    setAddingItem(false);
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditDeadline(item.deadline ? toDateInput(item.deadline) : "");
    setEditStatus((item.status as ItemStatus) ?? "active");
    setEditRecurring(parseRecurring(item.recurring));
  }

  function cancelEditing() {
    setEditingItemId(null);
    setEditTitle("");
    setEditDeadline("");
    setEditStatus("active");
    setEditRecurring(null);
  }

  function cancelAdding() {
    setAddingItem(false);
    setAddTitle("");
    setAddDeadline("");
    setAddStatus("active");
    setAddRecurring(null);
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
        addRecurring
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
        editRecurring
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
        <div className="flex items-center gap-2">
          <span
            className="h-3.5 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: accentColor }}
          />
          <span className="font-pixel text-sm leading-snug">{bucket.name}</span>
        </div>
        <div className="flex items-center gap-2">
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
              className="text-[11px]"
            >
              +
            </BracketButton>
          )}
          <BracketButton onClick={() => setSettingsOpen(true)} className="text-[11px]">
            <Settings size={10} />
          </BracketButton>
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
        recurring={addingItem ? addRecurring : editRecurring}
        error={addingItem ? addError : undefined}
        pending={addingItem ? addPending : editPending}
        onTitleChange={addingItem ? setAddTitle : setEditTitle}
        onDeadlineChange={addingItem ? setAddDeadline : setEditDeadline}
        onStatusChange={addingItem ? setAddStatus : setEditStatus}
        onRecurringChange={addingItem ? setAddRecurring : setEditRecurring}
        onConfirm={addingItem ? handleAdd : handleUpdate}
        onCancel={addingItem ? cancelAdding : cancelEditing}
        onDelete={editingItemId !== null ? handleDelete : undefined}
      />

      <BucketSettings open={settingsOpen} bucket={bucket} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
