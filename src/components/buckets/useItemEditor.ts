import { useState, useTransition } from "react";
import { offerUndoDelete } from "./undoDelete";
import { addItemAction, deleteItemAction, updateItemAction } from "@/app/(app)/actions";
import { parseRecurring } from "@/lib/items/occurrence";
import { deadlineValue } from "@/lib/time";
import type { items } from "@/lib/db/schema";
import type { RecurringConfig } from "@/types/rules";
import type { ItemStatus } from "./constants";

type Item = typeof items.$inferSelect;

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
  const [addAssignee, setAddAssignee] = useState<number | null>(null);
  const [addError, setAddError] = useState("");
  const [addPending, startAddTransition] = useTransition();

  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState<ItemStatus>(defaultStatus);
  const [editRecurring, setEditRecurring] = useState<RecurringConfig | null>(null);
  const [editProperties, setEditProperties] = useState<Record<string, unknown>>({});
  const [editReminders, setEditReminders] = useState<number[] | null>(null);
  const [editAssignee, setEditAssignee] = useState<number | null>(null);
  const [editError, setEditError] = useState("");
  const [editPending, startEditTransition] = useTransition();

  function cancelEditing() {
    setEditingItemId(null);
    setEditTitle("");
    setEditDeadline("");
    setEditStatus(defaultStatus);
    setEditRecurring(null);
    setEditProperties({});
    setEditReminders(null);
    setEditAssignee(null);
    setEditError("");
  }

  function cancelAdding() {
    setAddingItem(false);
    setAddTitle("");
    setAddDeadline("");
    setAddStatus(defaultStatus);
    setAddRecurring(null);
    setAddProperties({});
    setAddReminders(null);
    setAddAssignee(null);
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
    setEditDeadline(item.deadline ? deadlineValue(item.deadline, item.deadlineTimezone) : "");
    setEditStatus((item.status as ItemStatus) || defaultStatus);
    setEditRecurring(parseRecurring(item.recurring));
    setEditReminders(item.reminderOffsets);
    setEditAssignee(item.assigneeId);
    setEditProperties(
      item.properties ? (JSON.parse(item.properties) as Record<string, unknown>) : {}
    );
  }

  // The dialog passes the title without a date typed into it
  function handleAdd(title = addTitle, clock: string | null = null) {
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
        addReminders,
        addAssignee,
        clock
      );
      if (result.ok) {
        cancelAdding();
        await onSaved();
      } else {
        setAddError(result.error);
      }
    });
  }

  function handleUpdate(clock: string | null) {
    if (!editingItemId || !editTitle.trim() || editPending) return;
    setEditError("");
    startEditTransition(async () => {
      const result = await updateItemAction(
        editingItemId,
        editTitle,
        editDeadline || null,
        editStatus,
        editRecurring,
        Object.keys(editProperties).length > 0 ? editProperties : null,
        editReminders,
        editAssignee,
        clock
      );
      if (result.ok) {
        cancelEditing();
        await onSaved();
      } else {
        setEditError(result.error);
      }
    });
  }

  function handleDelete() {
    if (!editingItemId || editPending) return;
    const itemId = editingItemId;
    const title = editTitle;
    setEditError("");
    startEditTransition(async () => {
      const result = await deleteItemAction(itemId);
      if (!result.ok) {
        setEditError(result.error);
        return;
      }
      cancelEditing();
      await onSaved();
      offerUndoDelete(itemId, title, onSaved);
    });
  }

  return {
    editingItemId,
    startAdding,
    startEditing,
    assigneeId: addingItem ? addAssignee : editAssignee,
    setAssigneeId: addingItem ? setAddAssignee : setEditAssignee,
    dialogProps: {
      open: addingItem || editingItemId !== null,
      mode: addingItem ? ("add" as const) : ("edit" as const),
      title: addingItem ? addTitle : editTitle,
      deadline: addingItem ? addDeadline : editDeadline,
      status: addingItem ? addStatus : editStatus,
      properties: addingItem ? addProperties : editProperties,
      recurring: addingItem ? addRecurring : editRecurring,
      reminders: addingItem ? addReminders : editReminders,
      error: addingItem ? addError : editError,
      pending: addingItem ? addPending : editPending,
      onTitleChange: addingItem ? setAddTitle : setEditTitle,
      onDeadlineChange: addingItem ? setAddDeadline : setEditDeadline,
      onStatusChange: addingItem ? setAddStatus : setEditStatus,
      onPropertiesChange: addingItem ? setAddProperties : setEditProperties,
      onRecurringChange: addingItem ? setAddRecurring : setEditRecurring,
      onRemindersChange: addingItem ? setAddReminders : setEditReminders,
      onConfirm: (title: string | undefined, clock: string | null) =>
        addingItem ? handleAdd(title, clock) : handleUpdate(clock),
      onCancel: addingItem ? cancelAdding : cancelEditing,
      onDelete: editingItemId !== null ? handleDelete : undefined,
    },
  };
}
