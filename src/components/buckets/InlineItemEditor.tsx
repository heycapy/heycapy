"use client";

import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { useLookParts } from "@/components/looks/LookProvider";
import { IconButton } from "@/components/ui/IconButton";
import { TimeField, type TimeValue } from "@/components/ui/TimeField";
import { ITEM_STATUS } from "@/constants";
import type { BucketMember } from "@/lib/buckets/members";
import {
  inlinePatch,
  pickDate,
  pickTime,
  timeOf,
  type ClockTime,
  type InlineDraft,
  type ItemPatch,
} from "@/lib/items/edit-draft";
import { parseRecurring } from "@/lib/items/occurrence";
import type { ListItem } from "@/lib/reminders/status";
import { deadlineDate, deadlineValue, timeOfDeadline } from "@/lib/time";
import { smoothScroll } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { DetailChip } from "./DetailChip";
import { InlineTitle } from "./InlineTitle";
import { ItemDateChip } from "./ItemDateChip";
import { TickBox } from "./TickBox";
import { INLINE_EDIT_SECONDS } from "./constants";
import { useItemClock } from "./useItemClock";
import { useOutsideTap } from "./useOutsideTap";
import { withPatch } from "./optimistic";

type InlineItemEditorProps = {
  item: ListItem;
  color: string;
  members: BucketMember[];
  draggable: boolean;
  onCommit: (patch: ItemPatch) => void;
  onMore: (item: ListItem) => void;
  onExit: (focusRow: boolean) => void;
};

export function InlineItemEditor({
  item,
  color,
  members,
  draggable,
  onCommit,
  onMore,
  onExit,
}: InlineItemEditorProps) {
  const roundTick = useLookParts().tickBox === "round";
  const done = item.status === ITEM_STATUS.completed;
  const clock = useItemClock(members, item.assigneeIds);
  const zone = clock.zone;
  const rootRef = useRef<HTMLDivElement>(null);
  const [initial] = useState<InlineDraft>(() => ({
    title: item.title,
    deadline: item.deadline ? deadlineValue(item.deadline, item.deadlineTimezone) : "",
    recurring: parseRecurring(item.recurring),
  }));
  const [draft, setDraft] = useState(initial);
  const [remembered, setRemembered] = useState<ClockTime>(() =>
    timeOfDeadline(initial.deadline, zone)
  );
  const [closing, setClosing] = useState(false);
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

  function flush(): ItemPatch {
    const patch = inlinePatch(savedRef.current, draftRef.current, clock.clock);
    if (Object.keys(patch).length === 0) return patch;
    savedRef.current = draftRef.current;
    onCommit(patch);
    return patch;
  }

  function finish(save: boolean, refocus: boolean) {
    if (closedRef.current) return;
    closedRef.current = true;
    if (save) flush();
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

  function openMore() {
    if (closedRef.current) return;
    closedRef.current = true;
    onMore(withPatch(item, flush()));
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

  return (
    <div
      ref={rootRef}
      data-inline-edit
      role="group"
      aria-label="edit item"
      onKeyDown={onKeyDown}
      className="bg-muted/20 flex items-stretch gap-0 px-3"
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
        <InlineTitle
          value={draft.title}
          onChange={(title) => update({ ...draft, title })}
          onEnter={() => finish(true, true)}
        />
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
          <div className="flex flex-wrap items-center gap-1.5 pt-2 pb-3">
            <ItemDateChip value={datePart} zone={zone} onChange={pickDay} />
            {datePart && <TimeField value={time} onChange={pickClock} allowAllDay />}
            <DetailChip
              name="more"
              icon="more"
              label="more"
              set={false}
              open={false}
              onClick={openMore}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
