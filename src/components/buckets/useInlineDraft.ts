import { useRef, useState } from "react";
import type { TimeValue } from "@/components/ui/TimeField";
import {
  pickDate,
  pickRepeat,
  pickTime,
  timeOf,
  type ClockTime,
  type InlineDraft,
} from "@/lib/items/edit-draft";
import type { BucketMember } from "@/lib/buckets/members";
import { deadlineDate, moveClock, timeOfDeadline } from "@/lib/time";
import type { RecurringConfig } from "@/types/rules";
import { useItemClock } from "./useItemClock";

export function useInlineDraft(
  initial: InlineDraft,
  members: BucketMember[],
  onChange?: (draft: InlineDraft) => void
) {
  const [draft, setDraft] = useState(initial);
  const draftRef = useRef(initial);
  const clock = useItemClock(members, draft.assigneeIds);
  const zone = clock.zone;
  const [remembered, setRemembered] = useState<ClockTime>(() =>
    timeOfDeadline(initial.deadline, zone)
  );

  const time: TimeValue = timeOf(draft.deadline, zone, remembered);
  const datePart = deadlineDate(draft.deadline, zone);

  function update(next: InlineDraft) {
    draftRef.current = next;
    setDraft(next);
    onChange?.(next);
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

  return {
    draft,
    draftRef,
    update,
    clock,
    time,
    datePart,
    pickDay,
    pickClock,
    changeRepeat,
    changeAssignees,
    setProperty,
    pickZone,
  };
}

export type InlineDraftState = ReturnType<typeof useInlineDraft>;
