import { useEffect, useState } from "react";
import { deadlineHintsAction } from "@/app/(app)/actions";
import { memberName } from "@/lib/buckets/member-name";
import type { DeadlineHint } from "@/lib/reminders/deadline-hints";
import { clocksLine } from "@/lib/timezones/gap";
import { HINTS_DEBOUNCE_MS } from "./constants";
import { ItemClockField } from "./ItemClockField";
import type { AssigneeChoice } from "./ItemAssigneeField";
import type { useItemClock } from "./useItemClock";

function hintText(hint: DeadlineHint): string {
  const whose = hint.isYou ? "your" : `${hint.name}'s`;
  return [
    hint.night && `at night for ${hint.name}`,
    hint.heldPastDeadline
      ? `${whose} quiet hours hold the reminder until after it's due`
      : hint.quiet && `in ${whose} quiet hours`,
  ]
    .filter(Boolean)
    .join(" · ");
}

type ItemTimeHintsProps = {
  choice: AssigneeChoice;
  deadline: string;
  clock: ReturnType<typeof useItemClock>;
  reminders: number[] | null;
  onPickClock: (timezone: string) => void;
  disabled?: boolean;
};

// What the time means for the others: their time, and soft warnings that never block saving
export function ItemTimeHints({
  choice,
  deadline,
  clock: editClock,
  reminders,
  onPickClock,
  disabled,
}: ItemTimeHintsProps) {
  const { bucketId, members, value: assigneeId } = choice;
  const { clock, zone } = editClock;
  const [hints, setHints] = useState<{ key: string; list: DeadlineHint[] }>({ key: "", list: [] });
  const offsets = reminders ? reminders.join(",") : null;
  const key = JSON.stringify([bucketId, deadline, clock, assigneeId, offsets]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(() => {
      void deadlineHintsAction(bucketId, {
        deadline: deadline || null,
        clock,
        assigneeId,
        reminderOffsets: offsets === null ? null : offsets.split(",").filter(Boolean).map(Number),
      }).then((result) => {
        if (!cancelled && result.ok) setHints({ key, list: result.hints });
      });
    }, HINTS_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [key, bucketId, deadline, clock, assigneeId, offsets]);

  const assignee = members.find((m) => m.userId === assigneeId);
  const people = (
    assignee ? [...new Set([assignee, ...members.filter((m) => m.isYou)])] : members
  ).map((m) => ({ name: memberName(m), timezone: m.timezone, isYou: m.isYou }));
  const preview = deadline.includes("T") ? clocksLine(new Date(deadline), zone, people) : null;
  const warnings = hints.key === key ? hints.list : [];

  return (
    <div className="flex flex-col gap-1.5">
      {editClock.options.length > 0 && (
        <ItemClockField
          options={editClock.options}
          place={editClock.place}
          onPick={onPickClock}
          disabled={disabled}
        />
      )}
      {preview && (
        <p className="text-muted-foreground font-mono text-[11px]" data-testid="time-preview">
          {preview}
        </p>
      )}
      {warnings.map((hint) => (
        <p key={hint.name} role="status" className="text-warning font-mono text-[11px]">
          ⚠ {hintText(hint)}
        </p>
      ))}
    </div>
  );
}
