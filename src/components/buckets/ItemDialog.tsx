import { Pencil } from "pixelarticons/react/Pencil.js";
import { Plus } from "pixelarticons/react/Plus.js";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { type Ampm, type TimeValue } from "@/components/ui/TimeField";
import { ItemFieldsForm } from "./ItemFieldsForm";
import { ItemAssigneeField, type AssigneeChoice } from "./ItemAssigneeField";
import { ItemFrame } from "./ItemFrame";
import type { ItemPanel } from "./ItemPanelFrame";
import { ItemTitleField } from "./ItemTitleField";
import { ItemWhenSection } from "./ItemWhenSection";
import { ItemTimeHints } from "./ItemTimeHints";
import { useItemClock } from "./useItemClock";
import { useTitleDate } from "./useTitleDate";
import type { RecurringConfig, StatusDef, FieldDef } from "@/types/rules";
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
  // a new item whose date was picked in an earlier go at the form: typed words don't change it
  deadlinePicked?: boolean;
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
  onDeadlinePicked?: () => void;
  onStatusChange: (v: string) => void;
  onPropertiesChange?: (v: Record<string, unknown>) => void;
  onRecurringChange?: (v: RecurringConfig | null) => void;
  onRemindersChange?: (v: number[]) => void;
  onConfirm: (title: string | undefined, clock: string | null) => void;
  onCancel: () => void;
  onDelete?: () => void;
  assigneeChoice?: AssigneeChoice;
  panel?: ItemPanel;
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
  deadlinePicked = false,
  onDeadlinePicked,
  onStatusChange,
  onPropertiesChange,
  onRecurringChange,
  onRemindersChange,
  onConfirm,
  onCancel,
  onDelete,
  assigneeChoice,
  panel,
}: ItemDialogProps) {
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollToFirst = useScrollToFirst(scrollBodyRef);
  const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);
  const [timeHour, setTimeHour] = useState("9");
  const [timeMin, setTimeMin] = useState("00");
  const [timeAmpm, setTimeAmpm] = useState<Ampm>("am");
  const wasOpenRef = useRef(false);
  // kept while closing, so the form folds away in the frame it opened in
  const [frameMode, setFrameMode] = useState(mode);
  if (open && mode !== frameMode) setFrameMode(mode);
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
  const resetClock = clock.reset;
  const openingZone = clock.zoneFor(assigneeChoice?.value ?? null, null);
  const startTitleDate = useEffectEvent(() => {
    const typed = titleDate.start(title, deadlinePicked);
    if (!typed) return;
    const onZone = moveClock(typed, browserTimezone(), openingZone);
    onDeadlineChange(onZone);
    setTime(timeOfDeadline(onZone, openingZone));
  });

  const hasFields = !!(fields && fields.length > 0);

  const datePart = deadlineDate(deadline, zone);
  // A set time is read from the deadline on the current clock, the state keeps it while all day
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
      resetClock();
      setTime(timeOfDeadline(deadline, openingZone));
      startTitleDate();
    }, 0);
    return () => clearTimeout(id);
  }, [open, deadline, resetClock, openingZone]);

  function handleTitleChange(next: string) {
    onTitleChange(next);
    titleDate.typed(next);
  }

  function handleDateChange(newDate: string) {
    titleDate.pickByHand();
    onDeadlinePicked?.();
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
    onDeadlinePicked?.();
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
        assignees &&
        assignees.members.length > 1 && (
          <ItemTimeHints
            choice={assignees}
            deadline={deadline}
            clock={clock}
            reminders={reminders ?? bucketReminders ?? null}
            onPickClock={pickClock}
            disabled={pending}
          />
        )
      }
      withStatus={frameMode === "edit"}
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
      {frameMode === "add" ? "add" : "update"}
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

  const titleField = (boxed: boolean) => (
    <ItemTitleField
      open={open}
      rowIcon={boxed ? (frameMode === "add" ? Plus : Pencil) : undefined}
      value={title}
      error={error}
      showRequired={titleHasError}
      disabled={pending}
      typedDate={titleDate.match}
      mention={mention}
      onChange={handleTitleChange}
      onEnter={handleConfirmClick}
      onDismissDate={titleDate.dismiss}
    />
  );

  const details = (
    <>
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

  return (
    <ItemFrame
      open={open}
      mode={frameMode}
      isMobile={isMobile}
      panel={panel}
      wide={hasFields}
      scrollBodyRef={scrollBodyRef}
      titleField={titleField}
      details={details}
      confirm={confirmButton}
      deleteButton={deleteButton}
      onCancel={onCancel}
      onSubmit={handleConfirmClick}
    />
  );
}
