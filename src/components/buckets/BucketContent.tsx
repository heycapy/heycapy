"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { Settings } from "lucide-react";
import { ItemRow } from "./ItemRow";
import { ItemDialog } from "./ItemDialog";
import { BucketSettings } from "./BucketSettings";
import { BracketButton } from "@/components/ui/BracketButton";
import { parseDurationToDate } from "@/lib/duration";
import type { ItemStatus, ItemsRulesConfig } from "./constants";
import {
  addItemAction,
  updateItemAction,
  deleteItemAction,
  reorderItemsAction,
} from "@/app/(app)/actions";
import type { buckets, items as itemsTable } from "@/lib/db/schema";
import type { DragControls } from "framer-motion";

type BucketRow = typeof buckets.$inferSelect;
type Item = typeof itemsTable.$inferSelect;

interface BucketContentProps {
  bucket: BucketRow;
  items: Item[];
  accentColor: string;
}

function toDateInput(d: Date): string {
  return d.toISOString().split("T")[0];
}

function DraggableItem({
  item,
  orderedItemsRef,
  isEditing,
  onEditStart,
}: {
  item: Item;
  orderedItemsRef: React.RefObject<Item[]>;
  isEditing?: boolean;
  onEditStart?: () => void;
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
      />
    </Reorder.Item>
  );
}

export function BucketContent({ bucket, items, accentColor }: BucketContentProps) {
  const rules: ItemsRulesConfig = (() => {
    try {
      return JSON.parse(bucket.itemsRules) as ItemsRulesConfig;
    } catch {
      return {};
    }
  })();

  const isDraggable = rules.drag === true && rules.sort_by === "manual";
  const showCompleted = rules.show_completed !== false;
  const visibleItems = showCompleted ? items : items.filter((i) => i.status !== "completed");

  const [orderedItems, setOrderedItems] = useState(visibleItems);
  const orderedItemsRef = useRef(visibleItems);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingItem, setAddingItem] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDeadline, setAddDeadline] = useState("");
  const [addStatus, setAddStatus] = useState<ItemStatus>("active");
  const [addError, setAddError] = useState("");
  const [addPending, startAddTransition] = useTransition();

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState<ItemStatus>("active");
  const [editPending, startEditTransition] = useTransition();

  useEffect(() => {
    const next = showCompleted ? items : items.filter((i) => i.status !== "completed");
    const id = setTimeout(() => {
      setOrderedItems(next);
      orderedItemsRef.current = next;
    }, 0);
    return () => clearTimeout(id);
  }, [items, showCompleted]);

  function startEditing(item: Item) {
    setAddingItem(false);
    setEditingItemId(item.id);
    setEditTitle(item.title);
    setEditDeadline(item.deadline ? toDateInput(item.deadline) : "");
    setEditStatus((item.status as ItemStatus) ?? "active");
  }

  function cancelEditing() {
    setEditingItemId(null);
    setEditTitle("");
    setEditDeadline("");
    setEditStatus("active");
  }

  function cancelAdding() {
    setAddingItem(false);
    setAddTitle("");
    setAddDeadline("");
    setAddStatus("active");
    setAddError("");
  }

  function handleAdd() {
    if (!addTitle.trim() || addPending) return;
    setAddError("");
    startAddTransition(async () => {
      const result = await addItemAction(bucket.id, addTitle, addDeadline || null, addStatus);
      if (result.ok) {
        cancelAdding();
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
        editStatus
      );
      if (result.ok) cancelEditing();
    });
  }

  function handleDelete() {
    if (!editingItemId || editPending) return;
    startEditTransition(async () => {
      await deleteItemAction(editingItemId);
      cancelEditing();
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
                setAddDeadline(parseDurationToDate(rules.default_deadline_offset) ?? "");
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
        {orderedItems.length === 0 ? (
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
        error={addingItem ? addError : undefined}
        pending={addingItem ? addPending : editPending}
        onTitleChange={addingItem ? setAddTitle : setEditTitle}
        onDeadlineChange={addingItem ? setAddDeadline : setEditDeadline}
        onStatusChange={addingItem ? setAddStatus : setEditStatus}
        onConfirm={addingItem ? handleAdd : handleUpdate}
        onCancel={addingItem ? cancelAdding : cancelEditing}
        onDelete={editingItemId !== null ? handleDelete : undefined}
      />

      <BucketSettings open={settingsOpen} bucket={bucket} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
