"use client";

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { motion } from "framer-motion";
import { useLookParts } from "@/components/looks/LookProvider";
import { DoneButton } from "@/components/ui/DoneButton";
import { IconButton } from "@/components/ui/IconButton";
import { TimeField, type TimeValue } from "@/components/ui/TimeField";
import { ITEM_STATUS } from "@/constants";
import type { BucketMember } from "@/lib/buckets/members";
import {
  firstMissingRequired,
  inlinePatch,
  pickDate,
  pickRepeat,
  pickTime,
  timeOf,
  type ClockTime,
  type InlineDraft,
  type ItemPatch,
} from "@/lib/items/edit-draft";
import { parseRecurring } from "@/lib/items/occurrence";
import type { ListItem } from "@/lib/reminders/status";
import { deadlineDate, deadlineValue, moveClock, timeOfDeadline } from "@/lib/time";
import { smoothScroll } from "@/lib/motion";
import type { FieldDef, RecurringConfig, StatusDef } from "@/types/rules";
import { cn } from "@/lib/utils";
import { assigneeLabel, mentionAssignees } from "./assignee";
import { fieldChips } from "./fieldChipText";
import { InlineNotes } from "./InlineNotes";
import { InlineTitle } from "./InlineTitle";
import { ItemAssigneeField, type AssigneeChoice } from "./ItemAssigneeField";
import { ItemDateChip } from "./ItemDateChip";
import { ItemDetails } from "./ItemDetails";
import { ItemTimeHints } from "./ItemTimeHints";
import { TickBox } from "./TickBox";
import { INLINE_EDIT_SECONDS, type OpenFocus } from "./constants";
import { useItemClock } from "./useItemClock";
import { useOutsideTap } from "./useOutsideTap";

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
  const roundTick = useLookParts().tickBox === "round";
  const done = item.status === ITEM_STATUS.completed;
  const rootRef = useRef<HTMLDivElement>(null);
  const [initial] = useState(() => startingDraft(item));
  const [draft, setDraft] = useState(initial);
  const clock = useItemClock(members, draft.assigneeIds);
  const zone = clock.zone;
  const [remembered, setRemembered] = useState<ClockTime>(() =>
    timeOfDeadline(initial.deadline, zone)
  );
  const [closing, setClosing] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const draftRef = useRef(initial);
  const savedRef = useRef(initial);
  const closedRef = useRef(false);
  const refocusRef = useRef(false);

  const time: TimeValue = timeOf(draft.deadline, zone, remembered);
  const datePart = deadlineDate(draft.deadline, zone);

  function update(next: InlineDraft) {
    draftRef.current = next;
    setDraft(next);
  }

  function flush() {
    const patch = inlinePatch(savedRef.current, draftRef.current, clock.clock);
    if (Object.keys(patch).length === 0) return;
    savedRef.current = draftRef.current;
    onCommit(patch);
  }

  function finish(save: boolean, refocus: boolean) {
    if (closedRef.current) return;
    if (save) {
      const missing = firstMissingRequired(fields, draftRef.current.properties);
      if (missing) {
        setAttempted(true);
        requestAnimationFrame(() =>
          rootRef.current
            ?.querySelector(`[data-field-key="${missing.key}"]`)
            ?.scrollIntoView({ block: "nearest", behavior: smoothScroll() })
        );
        return;
      }
      flush();
    }
    closedRef.current = true;
    refocusRef.current = refocus;
    setClosing(true);
  }

  function pickDay(date: string) {
    const picked = pickDate(draft, date, time, zone, new Date());
    if (!draft.deadline) setRemembered(picked.time);
    update({ ...draft, deadline: picked.deadline, recurring: picked.recurring });
  }

  function pickClock(next: TimeValue) {
    setRemembered(next);
    update({ ...draft, deadline: pickTime(draft.deadline, next, zone) });
  }

  function changeRepeat(next: RecurringConfig | null) {
    update({ ...draft, ...pickRepeat(draft, next, time, zone) });
  }

  function changeAssignees(assigneeIds: number[]) {
    const current = draftRef.current;
    update({
      ...current,
      assigneeIds,
      deadline: moveClock(current.deadline, zone, clock.zoneFor(assigneeIds)),
    });
  }

  function setProperty(key: string, value: unknown) {
    update({ ...draft, properties: { ...draft.properties, [key]: value } });
  }

  function pickZone(timezone: string) {
    clock.pick(timezone);
    update({ ...draft, deadline: moveClock(draft.deadline, zone, timezone) });
  }

  const flushFromEffect = useEffectEvent(() => {
    if (!closedRef.current) flush();
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

  useOutsideTap(rootRef, () => finish(true, false));

  // A button that goes away when pressed (a reminder's ×) takes the focus with it, and Escape and
  // Ctrl+Enter only reach the row from inside it
  function keepFocus() {
    if (closedRef.current || document.activeElement !== document.body) return;
    rootRef.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(keepFocus, [draft]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(false, true);
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      finish(true, true);
    }
  }

  const choice: AssigneeChoice = {
    bucketId,
    members,
    value: draft.assigneeIds,
    onChange: changeAssignees,
  };
  const label = members.length > 1 ? assigneeLabel(members, draft.assigneeIds) : "everyone";
  const mention =
    members.length > 1
      ? {
          members,
          onPick: (userId: number | null) =>
            changeAssignees(mentionAssignees(members, draftRef.current.assigneeIds, userId)),
        }
      : undefined;
  const chips = fieldChips(fields, draft.properties, attempted);
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
      aria-label="edit item"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={() => requestAnimationFrame(keepFocus)}
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
      <div className={cn("flex items-start", done && "opacity-45")}>
        <TickBox title={item.title} checked={done} color={color} />
      </div>
      <div className={cn("min-w-0 flex-1", roundTick ? "pt-3" : "pt-2.5")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <InlineTitle
              value={draft.title}
              autoFocus={focus === "title"}
              mention={mention}
              onChange={(title) => update({ ...draft, title })}
              onEnter={() => finish(true, true)}
            />
          </div>
          <div className="-mt-1 -mr-0.5">
            <DoneButton label="save" icon="arrow-up" onClick={() => finish(true, true)} />
          </div>
        </div>
        {initial.description && notes}
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={closing ? { height: 0, opacity: 0 } : { height: "auto", opacity: 1 }}
          transition={{ duration: INLINE_EDIT_SECONDS }}
          onAnimationComplete={() => {
            if (closing) onExit(refocusRef.current);
            else rootRef.current?.scrollIntoView({ block: "nearest", behavior: smoothScroll() });
          }}
          className="-mx-1 overflow-hidden px-1"
        >
          {!initial.description && notes}
          <div className="pt-2 pb-3">
            <ItemDetails
              dateSlot={
                <>
                  <ItemDateChip value={datePart} zone={zone} onChange={pickDay} />
                  {datePart && <TimeField value={time} onChange={pickClock} allowAllDay />}
                </>
              }
              datePart={datePart}
              allDay={!draft.deadline.includes("T")}
              time={time}
              clock={
                members.length > 1 && (
                  <ItemTimeHints
                    choice={choice}
                    deadline={draft.deadline}
                    clock={clock}
                    reminders={draft.reminders ?? bucketReminders}
                    onPickClock={pickZone}
                  />
                )
              }
              withStatus
              status={draft.status}
              statuses={statuses}
              recurring={draft.recurring}
              reminders={draft.reminders}
              bucketReminders={bucketReminders}
              assignee={
                members.length > 1
                  ? {
                      label,
                      set: label !== "everyone",
                      field: <ItemAssigneeField choice={choice} />,
                    }
                  : undefined
              }
              fieldChips={chips}
              onFieldChange={setProperty}
              onDateChange={pickDay}
              onTimeChange={pickClock}
              onStatusChange={(status) => update({ ...draft, status })}
              onRecurringChange={changeRepeat}
              onRemindersChange={(reminders) => update({ ...draft, reminders })}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
