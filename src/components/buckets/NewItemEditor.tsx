"use client";

import { useRef, useState } from "react";
import { addItemAction } from "@/app/(app)/actions";
import { notify } from "@/components/ui/notify";
import type { BucketMember } from "@/lib/buckets/members";
import type { InlineDraft } from "@/lib/items/edit-draft";
import type { FieldDef, StatusDef } from "@/types/rules";
import { EMPTY_DRAFT, isEmptyDraft, useDraftStore, type ItemDraft } from "@/store/drafts";
import { useUIStore } from "@/store/ui";
import { resolveAssignees } from "./assignee";
import { InlineEditorLayout } from "./InlineEditorLayout";
import { TickBox } from "./TickBox";
import { useEditorExit } from "./useEditorExit";
import { useInlineDraft } from "./useInlineDraft";

type NewItemEditorProps = {
  bucketId: number;
  color: string;
  members: BucketMember[];
  statuses: StatusDef[];
  fields: FieldDef[];
  bucketReminders: number[];
  draggable: boolean;
  defaultDeadline: string;
  defaultStatus: string;
  onAdded: () => void;
  onExit: (focusRow: boolean) => void;
};

function sameIds(a: number[], b: number[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}

export function NewItemEditor({
  bucketId,
  color,
  members,
  statuses,
  fields,
  bucketReminders,
  draggable,
  defaultDeadline,
  defaultStatus,
  onAdded,
  onExit,
}: NewItemEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const updateDraft = useDraftStore((s) => s.updateDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);
  const markAdded = useUIStore((s) => s.markAdded);
  const [stored] = useState(() => useDraftStore.getState().drafts[bucketId] ?? EMPTY_DRAFT);
  const everyone = members.map((m) => m.userId);
  const datePickedAtOpen = stored.deadline !== null;

  const [initial] = useState<InlineDraft>(() => ({
    title: stored.title,
    description: stored.description ?? "",
    deadline: stored.deadline ?? defaultDeadline,
    recurring: stored.recurring,
    status: stored.status ?? defaultStatus,
    reminders: stored.reminders,
    assigneeIds: resolveAssignees(members, stored.assigneeIds),
    properties: stored.properties,
  }));

  // The draft stays in the store as it's edited, so a closed row loses nothing
  function toStored(next: InlineDraft, datePicked: boolean): Partial<ItemDraft> {
    return {
      title: next.title,
      description: next.description,
      deadline: datePicked || next.deadline !== initial.deadline ? next.deadline : null,
      recurring: next.recurring,
      reminders: next.reminders,
      assigneeIds: sameIds(next.assigneeIds, everyone) ? null : next.assigneeIds,
      properties: next.properties,
    };
  }

  const state = useInlineDraft(initial, members, (next) =>
    updateDraft(bucketId, toStored(next, datePickedAtOpen))
  );
  const { draft, draftRef, clock } = state;
  const blank = !draft.title.trim();

  function add() {
    const sent = draftRef.current;
    const restore = { ...EMPTY_DRAFT, ...toStored(sent, true) };
    clearDraft(bucketId);
    void (async () => {
      const result = await addItemAction(
        bucketId,
        sent.title.trim(),
        sent.deadline || null,
        stored.status ?? defaultStatus,
        sent.recurring,
        Object.keys(sent.properties).length > 0 ? sent.properties : null,
        sent.reminders,
        restore.assigneeIds ?? undefined,
        clock.clock,
        sent.description.trim() || undefined
      );
      if (result.ok) {
        markAdded(result.id);
        onAdded();
        return;
      }
      notify.error(result.error);
      const current = useDraftStore.getState().drafts[bucketId];
      if (!current || isEmptyDraft(current)) updateDraft(bucketId, restore);
    })();
  }

  const exit = useEditorExit({
    rootRef,
    draftRef,
    fields,
    canSave: () => !!draftRef.current.title.trim(),
    onSave: add,
    saveOnOutsideTap: false,
    onExit,
  });

  return (
    <InlineEditorLayout
      label="new item"
      rootRef={rootRef}
      state={state}
      exit={exit}
      tick={
        <div aria-hidden className="flex items-start">
          <TickBox title="" checked={false} color={color} />
        </div>
      }
      focus="title"
      notesStartOpen={initial.description !== ""}
      saveLabel="add"
      saveDisabled={blank}
      withStatus={false}
      bucketId={bucketId}
      members={members}
      statuses={statuses}
      fields={fields}
      bucketReminders={bucketReminders}
      draggable={draggable}
      onEnter={() => exit.finish(true, true)}
    />
  );
}
