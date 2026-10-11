import { useEffect, useRef, useState } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { type Ampm, type TimeValue } from "@/components/ui/TimeField";
import { ItemFieldsForm } from "./ItemFieldsForm";
import { ItemBucketField, type BucketChoice } from "./ItemBucketField";
import { ItemAssigneeField, type AssigneeChoice } from "./ItemAssigneeField";
import { ItemDialogFrame } from "./ItemDialogFrame";
import { ItemPageFrame } from "./ItemPageFrame";
import { ItemTitleField } from "./ItemTitleField";
import { ItemWhenSection } from "./ItemWhenSection";
import { ItemClockField } from "./ItemClockField";
import { useItemClock } from "./useItemClock";
import { useTitleDate } from "./useTitleDate";
import type { RecurringConfig, StatusDef, FieldDef } from "@/types/rules";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useScrollToFirst } from "@/hooks/useScrollToFirst";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  browserTimezone,
  buildDeadline,
  deadlineDate,
  defaultTimeFor,
  lastDayOfMonth,
  moveClock,
  timeOfDeadline,
} from "@/lib/time";
import { isLastDayRepeat } from "@/lib/items/occurrence";
import { MOBILE_MEDIA_QUERY } from "@/constants";

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && !value.trim()) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

type ItemDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  title: string;
  deadline: string;
  status: string;
  statuses: StatusDef[];
  fields?: FieldDef[];
  properties?: Record<string, unknown>;
  recurring?: RecurringConfig | null;
  reminders?: number[] | null;
  bucketReminders?: number[];
  error?: string;
  pending?: boolean;
  onTitleChange: (v: string) => void;
  onDeadlineChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onPropertiesChange?: (v: Record<string, unknown>) => void;
  onRecurringChange?: (v: RecurringConfig | null) => void;
  onRemindersChange?: (v: number[]) => void;
  onConfirm: (title: string | undefined, clock: string | null) => void;
  onCancel: () => void;
  onDelete?: () => void;
  bucketChoice?: BucketChoice;
  assigneeChoice?: AssigneeChoice;
};

export function ItemDialog({
  open,
  mode,
  title,
  deadline,
  status,
  statuses,
  fields,
  properties,
  recurring,
  reminders,
  bucketReminders,
  error,
  pending,
  onTitleChange,
  onDeadlineChange,
  onStatusChange,
  onPropertiesChange,
  onRecurringChange,
  onRemindersChange,
  onConfirm,
  onCancel,
  onDelete,
  bucketChoice,
  assigneeChoice,
}: ItemDialogProps) {
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollToFirst = useScrollToFirst(scrollBodyRef);
  useScrollLock(open);
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [timeHour, setTimeHour] = useState("9");
  const [timeMin, setTimeMin] = useState("00");
  const [timeAmpm, setTimeAmpm] = useState<Ampm>("am");
  const wasOpenRef = useRef(false);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const clock = useItemClock(assigneeChoice?.members ?? [], assigneeChoice?.value ?? null);
  const zone = clock.zone;
  const titleDate = useTitleDate({
    active: mode === "add",
    title,
    deadline,
    onDeadlineChange: (next) => {
      const onZone = moveClock(next, browserTimezone(), zone);
      onDeadlineChange(onZone);
      setTime(timeOfDeadline(onZone, zone));
    },
  });
  const resetTitleDate = titleDate.reset;
  const resetClock = clock.reset;
  const openingZone = clock.zoneFor(assigneeChoice?.value ?? null, null);

  const hasFields = !!(fields && fields.length > 0);

  const datePart = deadlineDate(deadline, zone);
  // A set time is read from the deadline on the current clock; the state keeps it while all day
  const time: TimeValue = deadline.includes("T")
    ? timeOfDeadline(deadline, zone)
    : { hour: timeHour, min: timeMin, ampm: timeAmpm };

  const hasEmptyRequired = !!fields?.some(
    (f) => f.validation?.required && isEmpty(properties?.[f.key])
  );

  useEffect(() => {
    const didJustOpen = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!didJustOpen) return;
    const id = setTimeout(() => {
      setValidationAttempted(false);
      resetTitleDate();
      resetClock();
      setTime(timeOfDeadline(deadline, openingZone));
    }, 0);
    return () => clearTimeout(id);
  }, [open, deadline, resetTitleDate, resetClock, openingZone]);

  function handleTitleChange(next: string) {
    onTitleChange(next);
    titleDate.typed(next);
  }

  function handleDateChange(newDate: string) {
    titleDate.pickByHand();
    const date = newDate && isLastDayRepeat(recurring) ? lastDayOfMonth(newDate) : newDate;
    const next = deadline ? time : defaultTimeFor(date, new Date(), zone);
    if (!deadline) setTime(next);
    onDeadlineChange(buildDeadline(date, next.hour, next.min, next.ampm, zone));
    if (!newDate) onRecurringChange?.(null);
  }

  function setTime({ hour, min, ampm }: TimeValue) {
    setTimeHour(hour);
    setTimeMin(min);
    setTimeAmpm(ampm);
  }

  function handleRecurringChange(next: RecurringConfig | null) {
    onRecurringChange?.(next);
    if (!datePart || !isLastDayRepeat(next)) return;
    onDeadlineChange(buildDeadline(lastDayOfMonth(datePart), time.hour, time.min, time.ampm, zone));
  }

  function handleTimeChange(time: TimeValue) {
    titleDate.pickByHand();
    setTime(time);
    if (datePart) onDeadlineChange(buildDeadline(datePart, time.hour, time.min, time.ampm, zone));
  }

  // The time shown stays as it is on the new clock
  function changeClock(next: string) {
    onDeadlineChange(moveClock(deadline, zone, next));
  }

  function changeAssignee(id: number | null) {
    changeClock(clock.zoneFor(id));
    assigneeChoice?.onChange(id);
  }

  function pickClock(timezone: string) {
    changeClock(timezone);
    clock.pick(timezone);
  }

  function handleConfirmClick() {
    setValidationAttempted(true);
    if (!title.trim()) {
      scrollToFirst("[data-title-section]");
      return;
    }
    if (hasEmptyRequired) {
      const firstEmpty = fields?.find(
        (f) => f.validation?.required && isEmpty(properties?.[f.key])
      );
      if (firstEmpty) scrollToFirst(`[data-field-key="${firstEmpty.key}"]`);
      return;
    }
    onConfirm(titleDate.match?.title, clock.clock);
  }

  const titleHasError = validationAttempted && !title.trim();
  const assignees = assigneeChoice && { ...assigneeChoice, onChange: changeAssignee };
  const mention =
    assignees && assignees.members.length > 1
      ? { members: assignees.members, onPick: changeAssignee }
      : undefined;

  const whenAndStatus = (
    <ItemWhenSection
      datePart={datePart}
      allDay={!deadline.includes("T")}
      time={time}
      clock={
        clock.options.length > 0 && (
          <ItemClockField
            options={clock.options}
            place={clock.place}
            onPick={pickClock}
            disabled={pending}
          />
        )
      }
      status={status}
      statuses={statuses}
      recurring={recurring}
      reminders={reminders}
      bucketReminders={bucketReminders}
      pending={pending}
      onDateChange={handleDateChange}
      onTimeChange={handleTimeChange}
      onStatusChange={onStatusChange}
      onRecurringChange={onRecurringChange && handleRecurringChange}
      onRemindersChange={onRemindersChange}
    />
  );

  const confirmButton = (
    <BracketButton
      onClick={handleConfirmClick}
      disabled={pending}
      className="text-foreground px-2 py-3 text-base"
    >
      {mode === "add" ? "add" : "update"}
    </BracketButton>
  );
  const deleteButton = onDelete && (
    <BracketButton
      onClick={onDelete}
      disabled={pending}
      variant="destructive"
      aria-label="delete item"
    >
      delete
    </BracketButton>
  );

  const form = (
    <>
      <ItemTitleField
        open={open}
        value={title}
        error={error}
        showRequired={titleHasError}
        disabled={pending}
        typedDate={titleDate.match}
        mention={mention}
        onChange={handleTitleChange}
        onEnter={handleConfirmClick}
        onEscape={onCancel}
        onDismissDate={titleDate.dismiss}
      />

      {bucketChoice && <ItemBucketField choice={bucketChoice} disabled={pending} />}

      {assignees && assignees.members.length > 1 && (
        <ItemAssigneeField choice={assignees} disabled={pending} />
      )}

      {hasFields ? (
        <div className="flex flex-col gap-5">
          {onPropertiesChange && fields && (
            <div className="border-border border">
              <ItemFieldsForm
                fields={fields}
                values={properties ?? {}}
                disabled={pending}
                showErrors={validationAttempted}
                onChange={onPropertiesChange}
              />
            </div>
          )}
          {whenAndStatus}
        </div>
      ) : (
        <div className="flex flex-col gap-5">{whenAndStatus}</div>
      )}
    </>
  );

  const heading = mode === "add" ? "new item" : "edit item";

  if (isMobile) {
    return (
      <ItemPageFrame
        open={open}
        heading={heading}
        scrollBodyRef={scrollBodyRef}
        onCancel={onCancel}
        confirm={confirmButton}
        secondary={
          deleteButton && <div className="border-border mt-6 border-t pt-4">{deleteButton}</div>
        }
      >
        {form}
      </ItemPageFrame>
    );
  }

  return (
    <ItemDialogFrame
      open={open}
      heading={heading}
      wide={hasFields}
      scrollBodyRef={scrollBodyRef}
      onCancel={onCancel}
      footer={
        <div className="flex w-full items-center justify-between">
          {deleteButton || <span />}
          {confirmButton}
        </div>
      }
    >
      {form}
    </ItemDialogFrame>
  );
}
