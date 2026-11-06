import { useState, useTransition } from "react";
import { offerUndoDelete } from "./undoDelete";
import { addItemAction, deleteItemAction, updateItemAction } from "@/app/(app)/actions";
import { parseRecurring } from "@/lib/items/occurrence";
import { deadlineValue } from "@/lib/time";
import type { items } from "@/lib/db/schema";
import type { RecurringConfig } from "@/types/rules";
import type { ItemStatus } from "./constants";
import { useDraft, useDraftStore } from "@/store/drafts";
import { useUIStore } from "@/store/ui";

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
  // A new item lives in the bucket's draft, shared with the add box, so closing the form keeps it
  const draft = useDraft(bucketId);
  const updateDraft = useDraftStore((s) => s.updateDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const markAdded = useUIStore((s) => s.markAdded);
  const [addingItem, setAddingItem] = useState(false);
  // "when" from words typed in the title or the bucket's default; a picked date lives in the draft
  const [typedDeadline, setTypedDeadline] = useState("");
  const addDeadline = draft.deadline ?? typedDeadline;
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

  function closeAdding() {
    setAddingItem(false);
    setAddError("");
  }

  function startAdding() {
    cancelEditing();
    setTypedDeadline(defaultDeadline());
    setAddingItem(true);
  }

  // read from the store: the form marks the date picked and changes it in one go
  function changeAddDeadline(next: string) {
    const picked = (useDraftStore.getState().drafts[bucketId]?.deadline ?? null) !== null;
    if (picked) updateDraft(bucketId, { deadline: next });
    else setTypedDeadline(next);
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
  function handleAdd(title = draft.title, clock: string | null = null) {
    if (!title.trim() || addPending) return;
    setAddError("");
    startAddTransition(async () => {
      const result = await addItemAction(
        bucketId,
        title,
        addDeadline || null,
        draft.status ?? defaultStatus,
        draft.recurring,
        Object.keys(draft.properties).length > 0 ? draft.properties : null,
        draft.reminders,
        draft.assigneeId,
        clock
      );
      if (result.ok) {
        closeAdding();
        clearDraft(bucketId);
        markAdded(result.id);
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
    assigneeId: addingItem ? draft.assigneeId : editAssignee,
    setAssigneeId: addingItem
      ? (assigneeId: number | null) => updateDraft(bucketId, { assigneeId })
      : setEditAssignee,
    dialogProps: {
      open: addingItem || editingItemId !== null,
      mode: addingItem ? ("add" as const) : ("edit" as const),
      title: addingItem ? draft.title : editTitle,
      deadline: addingItem ? addDeadline : editDeadline,
      deadlinePicked: addingItem && draft.deadline !== null,
      status: addingItem ? (draft.status ?? defaultStatus) : editStatus,
      properties: addingItem ? draft.properties : editProperties,
      recurring: addingItem ? draft.recurring : editRecurring,
      reminders: addingItem ? draft.reminders : editReminders,
      error: addingItem ? addError : editError,
      pending: addingItem ? addPending : editPending,
      onTitleChange: addingItem
        ? (title: string) => updateDraft(bucketId, { title })
        : setEditTitle,
      onDeadlineChange: addingItem ? changeAddDeadline : setEditDeadline,
      onDeadlinePicked: () => {
        if (addingItem && draft.deadline === null) updateDraft(bucketId, { deadline: addDeadline });
      },
      onStatusChange: addingItem
        ? (status: ItemStatus) => updateDraft(bucketId, { status })
        : setEditStatus,
      onPropertiesChange: addingItem
        ? (properties: Record<string, unknown>) => updateDraft(bucketId, { properties })
        : setEditProperties,
      onRecurringChange: addingItem
        ? (recurring: RecurringConfig | null) => updateDraft(bucketId, { recurring })
        : setEditRecurring,
      onRemindersChange: addingItem
        ? (reminders: number[] | null) => updateDraft(bucketId, { reminders })
        : setEditReminders,
      onConfirm: (title: string | undefined, clock: string | null) =>
        addingItem ? handleAdd(title, clock) : handleUpdate(clock),
      onCancel: addingItem ? closeAdding : cancelEditing,
      onDelete: editingItemId !== null ? handleDelete : undefined,
    },
  };
}
