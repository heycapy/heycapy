import { useState, useTransition } from "react";
import { offerUndoDelete } from "./undoDelete";
import { addItemAction, deleteItemAction, updateItemAction } from "@/app/(app)/actions";
import { parseRecurring } from "@/lib/items/occurrence";
import type { items } from "@/lib/db/schema";
import type { RecurringConfig } from "@/types/rules";
import type { ItemStatus } from "./constants";

type Item = typeof items.$inferSelect;

function toLocalDatetimeStr(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  const h = d.getHours();
  const m = d.getMinutes();
  if (h === 0 && m === 0) return `${y}-${mo}-${dy}`;
  return `${y}-${mo}-${dy}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

type ItemEditorOptions = {
  bucketId: number;
  defaultStatus: ItemStatus;
  defaultDeadline: () => string;
  onSaved: () => Promise<void>;
};

export function useItemEditor({
  bucketId,
  defaultStatus,
  defaultDeadline,
  onSaved,
}: ItemEditorOptions) {
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

  function startAdding() {
    cancelEditing();
    setAddDeadline(defaultDeadline());
    setAddingItem(true);
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

  function handleAdd() {
    if (!addTitle.trim() || addPending) return;
    setAddError("");
    startAddTransition(async () => {
      const result = await addItemAction(
        bucketId,
        addTitle,
        addDeadline || null,
        addStatus,
        addRecurring,
        Object.keys(addProperties).length > 0 ? addProperties : null
      );
      if (result.ok) {
        cancelAdding();
        await onSaved();
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
        await onSaved();
      }
    });
  }

  function handleDelete() {
    if (!editingItemId || editPending) return;
    const itemId = editingItemId;
    const title = editTitle;
    startEditTransition(async () => {
      await deleteItemAction(itemId);
      cancelEditing();
      await onSaved();
      offerUndoDelete(itemId, title, onSaved);
    });
  }

  return {
    editingItemId,
    startAdding,
    startEditing,
    dialogProps: {
      open: addingItem || editingItemId !== null,
      mode: addingItem ? ("add" as const) : ("edit" as const),
      title: addingItem ? addTitle : editTitle,
      deadline: addingItem ? addDeadline : editDeadline,
      status: addingItem ? addStatus : editStatus,
      properties: addingItem ? addProperties : editProperties,
      recurring: addingItem ? addRecurring : editRecurring,
      error: addingItem ? addError : undefined,
      pending: addingItem ? addPending : editPending,
      onTitleChange: addingItem ? setAddTitle : setEditTitle,
      onDeadlineChange: addingItem ? setAddDeadline : setEditDeadline,
      onStatusChange: addingItem ? setAddStatus : setEditStatus,
      onPropertiesChange: addingItem ? setAddProperties : setEditProperties,
      onRecurringChange: addingItem ? setAddRecurring : setEditRecurring,
      onConfirm: addingItem ? handleAdd : handleUpdate,
      onCancel: addingItem ? cancelAdding : cancelEditing,
      onDelete: editingItemId !== null ? handleDelete : undefined,
    },
  };
}
