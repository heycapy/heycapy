"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import { motion } from "framer-motion";
import { useLookParts } from "@/components/looks/LookProvider";
import { DoneButton } from "@/components/ui/DoneButton";
import { SubmitKeyHint } from "@/components/ui/KeyHint";
import { IconButton } from "@/components/ui/IconButton";
import { TimeField } from "@/components/ui/TimeField";
import type { BucketMember } from "@/lib/buckets/members";
import { useLayoutStore } from "@/store/layout";
import type { FieldDef, StatusDef } from "@/types/rules";
import { cn } from "@/lib/utils";
import { assigneeLabel, mentionAssignees } from "./assignee";
import { fieldChips } from "./fieldChipText";
import { InlineNotes } from "./InlineNotes";
import { InlineTitle } from "./InlineTitle";
import { ItemAssigneeField, type AssigneeChoice } from "./ItemAssigneeField";
import { ItemDateChip } from "./ItemDateChip";
import { ItemDetails } from "./ItemDetails";
import { ItemTimeHints } from "./ItemTimeHints";
import { INLINE_EDIT_SECONDS, type OpenFocus } from "./constants";
import type { InlineDraftState } from "./useInlineDraft";
import type { useEditorExit } from "./useEditorExit";

type InlineEditorLayoutProps = {
  label: "edit item" | "new item";
  rootRef: RefObject<HTMLDivElement | null>;
  state: InlineDraftState;
  exit: ReturnType<typeof useEditorExit>;
  tick: ReactNode;
  focus: OpenFocus;
  notesStartOpen: boolean;
  saveLabel: "save" | "add";
  saveDisabled?: boolean;
  withStatus: boolean;
  bucketId: number;
  members: BucketMember[];
  statuses: StatusDef[];
  fields: FieldDef[];
  bucketReminders: number[];
  draggable: boolean;
  onEnter: () => void;
};

export function InlineEditorLayout({
  label,
  rootRef,
  state,
  exit,
  tick,
  focus,
  notesStartOpen,
  saveLabel,
  saveDisabled,
  withStatus,
  bucketId,
  members,
  statuses,
  fields,
  bucketReminders,
  draggable,
  onEnter,
}: InlineEditorLayoutProps) {
  const roundTick = useLookParts().tickBox === "round";
  const { draft, draftRef, update, clock, time, datePart } = state;
  const editorOpened = useLayoutStore((s) => s.editorOpened);
  const editorClosed = useLayoutStore((s) => s.editorClosed);

  useEffect(() => {
    editorOpened();
    return editorClosed;
  }, [editorOpened, editorClosed]);

  const choice: AssigneeChoice = {
    bucketId,
    members,
    value: draft.assigneeIds,
    onChange: state.changeAssignees,
  };
  const shared = members.length > 1;
  const assigneeName = shared ? assigneeLabel(members, draft.assigneeIds) : "everyone";
  const mention = shared
    ? {
        members,
        onPick: (userId: number | null) =>
          state.changeAssignees(mentionAssignees(members, draftRef.current.assigneeIds, userId)),
      }
    : undefined;
  const notes = (
    <InlineNotes
      value={draft.description}
      autoFocus={focus === "notes"}
      onChange={(description) => update({ ...draft, description })}
    />
  );

  return (
    <div
      ref={rootRef}
      data-inline-edit
      data-handles-escape
      role="group"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={exit.onKeyDown}
      onClick={() => requestAnimationFrame(exit.keepFocus)}
      className="bg-muted/20 flex items-stretch gap-0 px-3 outline-none"
    >
      {draggable && (
        <IconButton
          icon="grip"
          disabled
          tabIndex={-1}
          aria-label="drag to reorder"
          className="invisible flex items-center justify-center pr-2.5"
        />
      )}
      {tick}
      <div className={cn("min-w-0 flex-1", roundTick ? "pt-3" : "pt-2.5")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <InlineTitle
              value={draft.title}
              autoFocus={focus === "title"}
              mention={mention}
              onChange={(title) => update({ ...draft, title })}
              onEnter={onEnter}
            />
          </div>
          <div className="-mt-1 -mr-0.5 flex items-center gap-1">
            <SubmitKeyHint form className="ml-0" />
            <DoneButton
              label={saveLabel}
              icon="arrow-up"
              disabled={saveDisabled}
              onClick={onEnter}
            />
          </div>
        </div>
        {notesStartOpen && notes}
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={exit.closing ? { height: 0, opacity: 0 } : { height: "auto", opacity: 1 }}
          transition={{ duration: INLINE_EDIT_SECONDS }}
          onUpdate={() => {
            if (!exit.closing) rootRef.current?.scrollIntoView({ block: "nearest" });
          }}
          onAnimationComplete={() => {
            if (exit.closing) exit.folded();
          }}
          className="-mx-1 overflow-hidden px-1"
        >
          {!notesStartOpen && notes}
          <div className="pt-2 pb-3">
            <ItemDetails
              dateSlot={
                <>
                  <ItemDateChip value={datePart} zone={clock.zone} onChange={state.pickDay} />
                  {datePart && <TimeField value={time} onChange={state.pickClock} allowAllDay />}
                </>
              }
              datePart={datePart}
              allDay={!draft.deadline.includes("T")}
              clock={
                shared && (
                  <ItemTimeHints
                    choice={choice}
                    deadline={draft.deadline}
                    clock={clock}
                    reminders={draft.reminders ?? bucketReminders}
                    onPickClock={state.pickZone}
                  />
                )
              }
              withStatus={withStatus}
              status={draft.status}
              statuses={statuses}
              recurring={draft.recurring}
              reminders={draft.reminders}
              bucketReminders={bucketReminders}
              assignee={
                shared
                  ? {
                      label: assigneeName,
                      set: assigneeName !== "everyone",
                      field: <ItemAssigneeField choice={choice} />,
                    }
                  : undefined
              }
              fieldChips={fieldChips(fields, draft.properties, exit.attempted)}
              onFieldChange={state.setProperty}
              onStatusChange={(status) => update({ ...draft, status })}
              onRecurringChange={state.changeRepeat}
              onRemindersChange={(reminders) => update({ ...draft, reminders })}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
