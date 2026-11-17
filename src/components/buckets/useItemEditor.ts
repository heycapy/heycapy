import { useState, useTransition } from "react";
import { addItemAction } from "@/app/(app)/actions";
import type { RecurringConfig } from "@/types/rules";
import type { ItemStatus } from "./constants";
import { useDraft, useDraftStore } from "@/store/drafts";
import { useUIStore } from "@/store/ui";

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
  const draft = useDraft(bucketId);
  const updateDraft = useDraftStore((s) => s.updateDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const markAdded = useUIStore((s) => s.markAdded);
  const [addingItem, setAddingItem] = useState(false);
  const [typedDeadline, setTypedDeadline] = useState("");
  const addDeadline = draft.deadline ?? typedDeadline;
  const [addError, setAddError] = useState("");
  const [addPending, startAddTransition] = useTransition();

  function closeAdding() {
    setAddingItem(false);
    setAddError("");
  }

  function startAdding() {
    setTypedDeadline(defaultDeadline());
    setAddingItem(true);
  }

  function changeAddDeadline(next: string) {
    const picked = (useDraftStore.getState().drafts[bucketId]?.deadline ?? null) !== null;
    if (picked) updateDraft(bucketId, { deadline: next });
    else setTypedDeadline(next);
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
        draft.assigneeIds ?? undefined,
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

  return {
    startAdding,
    assigneeIds: draft.assigneeIds,
    setAssigneeIds: (assigneeIds: number[]) => updateDraft(bucketId, { assigneeIds }),
    dialogProps: {
      open: addingItem,
      title: draft.title,
      deadline: addDeadline,
      deadlinePicked: draft.deadline !== null,
      status: draft.status ?? defaultStatus,
      properties: draft.properties,
      recurring: draft.recurring,
      reminders: draft.reminders,
      error: addError,
      pending: addPending,
      onTitleChange: (title: string) => updateDraft(bucketId, { title }),
      onDeadlineChange: changeAddDeadline,
      onDeadlinePicked: () => {
        if (draft.deadline === null) updateDraft(bucketId, { deadline: addDeadline });
      },
      onStatusChange: (status: ItemStatus) => updateDraft(bucketId, { status }),
      onPropertiesChange: (properties: Record<string, unknown>) =>
        updateDraft(bucketId, { properties }),
      onRecurringChange: (recurring: RecurringConfig | null) =>
        updateDraft(bucketId, { recurring }),
      onRemindersChange: (reminders: number[] | null) => updateDraft(bucketId, { reminders }),
      onConfirm: handleAdd,
      onCancel: closeAdding,
    },
  };
}
