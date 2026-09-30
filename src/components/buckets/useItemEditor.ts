import { useState, useTransition } from "react";
import { offerUndoDelete } from "./undoDelete";
import { addItemAction, deleteItemAction, updateItemAction } from "@/app/(app)/actions";
import { parseRecurring } from "@/lib/items/occurrence";
import type { items } from "@/lib/db/schema";
import type { RecurringConfig } from "@/types/rules";
import type { ItemStatus } from "./constants";

type Item = typeof items.$inferSelect;

function toDeadlineStr(d: Date): string {
  if (d.getHours() !== 0 || d.getMinutes() !== 0) return d.toISOString();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mo}-${dy}`;
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
  const [addReminders, setAddReminders] = useState<number[] | null>(null);
  const [addError, setAddError] = useState("");
  const [addPending, startAddTransition] = useTransition();

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState<ItemStatus>(defaultStatus);
  const [editRecurring, setEditRecurring] = useState<RecurringConfig | null>(null);
  const [editProperties, setEditProperties] = useState<Record<string, unknown>>({});
  const [editReminders, setEditReminders] = useState<number[] | null>(null);
  const [editPending, startEditTransition] = useTransition();

  function cancelEditing() {
    setEditingItemId(null);
    setEditTitle("");
    setEditDeadline("");
    setEditStatus(defaultStatus);
    setEditRecurring(null);
    setEditProperties({});
    setEditReminders(null);
  }

  function cancelAdding() {
    setAddingItem(false);
    setAddTitle("");
    setAddDeadline("");
    setAddStatus(defaultStatus);
    setAddRecurring(null);
    setAddProperties({});
    setAddReminders(null);
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
    setEditDeadline(item.deadline ? toDeadlineStr(item.deadline) : "");
    setEditStatus((item.status as ItemStatus) || defaultStatus);
    setEditRecurring(parseRecurring(item.recurring));
    setEditReminders(item.reminderOffsets);
    setEditProperties(
      item.properties ? (JSON.parse(item.properties) as Record<string, unknown>) : {}
    );
  }

  // The dialog passes the title without a date typed into it
  function handleAdd(title = addTitle) {
    if (!title.trim() || addPending) return;
    setAddError("");
    startAddTransition(async () => {
      const result = await addItemAction(
        bucketId,
        title,
        addDeadline || null,
        addStatus,
        addRecurring,
        Object.keys(addProperties).length > 0 ? addProperties : null,
        addReminders
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
        Object.keys(editProperties).length > 0 ? editProperties : null,
        editReminders
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
      reminders: addingItem ? addReminders : editReminders,
      error: addingItem ? addError : undefined,
      pending: addingItem ? addPending : editPending,
      onTitleChange: addingItem ? setAddTitle : setEditTitle,
      onDeadlineChange: addingItem ? setAddDeadline : setEditDeadline,
      onStatusChange: addingItem ? setAddStatus : setEditStatus,
      onPropertiesChange: addingItem ? setAddProperties : setEditProperties,
      onRecurringChange: addingItem ? setAddRecurring : setEditRecurring,
      onRemindersChange: addingItem ? setAddReminders : setEditReminders,
      onConfirm: addingItem ? handleAdd : handleUpdate,
      onCancel: addingItem ? cancelAdding : cancelEditing,
      onDelete: editingItemId !== null ? handleDelete : undefined,
    },
  };
}
