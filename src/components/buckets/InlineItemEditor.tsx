"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ITEM_STATUS } from "@/constants";
import type { BucketMember } from "@/lib/buckets/members";
import { inlinePatch, type InlineDraft, type ItemPatch } from "@/lib/items/edit-draft";
import { parseRecurring } from "@/lib/items/occurrence";
import type { ListItem } from "@/lib/reminders/status";
import { deadlineValue } from "@/lib/time";
import type { FieldDef, StatusDef } from "@/types/rules";
import { cn } from "@/lib/utils";
import { InlineEditorLayout } from "./InlineEditorLayout";
import { TickBox } from "./TickBox";
import type { OpenFocus } from "./constants";
import { useEditorExit } from "./useEditorExit";
import { useInlineDraft } from "./useInlineDraft";

type InlineItemEditorProps = {
  item: ListItem;
  focus: OpenFocus;
  color: string;
  bucketId: number;
  members: BucketMember[];
  statuses: StatusDef[];
  fields: FieldDef[];
  bucketReminders: number[];
  draggable: boolean;
  onCommit: (patch: ItemPatch) => void;
  onExit: (focusRow: boolean) => void;
};

function startingDraft(item: ListItem): InlineDraft {
  return {
    title: item.title,
    description: item.description ?? "",
    deadline: item.deadline ? deadlineValue(item.deadline, item.deadlineTimezone) : "",
    recurring: parseRecurring(item.recurring),
    status: item.status,
    reminders: item.reminderOffsets,
    assigneeIds: item.assigneeIds,
    properties: item.properties ? (JSON.parse(item.properties) as Record<string, unknown>) : {},
  };
}

export function InlineItemEditor({
  item,
  focus,
  color,
  bucketId,
  members,
  statuses,
  fields,
  bucketReminders,
  draggable,
  onCommit,
  onExit,
}: InlineItemEditorProps) {
  const done = item.status === ITEM_STATUS.completed;
  const rootRef = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => startingDraft(item));
  const savedRef = useRef(initial);
  const state = useInlineDraft(initial, members);
  const { draftRef, clock } = state;

  function flush() {
    const patch = inlinePatch(savedRef.current, draftRef.current, clock.clock);
    if (Object.keys(patch).length === 0) return;
    savedRef.current = draftRef.current;
    onCommit(patch);
  }

  const exit = useEditorExit({
    rootRef,
    draftRef,
    fields,
    onSave: flush,
    saveOnOutsideTap: true,
    onExit,
  });

  const flushFromEffect = useEffectEvent(() => {
    if (!exit.closedRef.current) flush();
  });

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushFromEffect();
    };
    window.addEventListener("pagehide", flushFromEffect);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flushFromEffect);
      document.removeEventListener("visibilitychange", onHidden);
      flushFromEffect();
    };
  }, []);

  return (
    <InlineEditorLayout
      label="edit item"
      rootRef={rootRef}
      state={state}
      exit={exit}
      tick={
        <div className={cn("flex items-start", done && "opacity-45")}>
          <TickBox title={item.title} checked={done} color={color} />
        </div>
      }
      focus={focus}
      notesStartOpen={initial.description !== ""}
      saveLabel="save"
      withStatus
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
