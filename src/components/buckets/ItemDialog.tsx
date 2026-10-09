import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { BracketButton } from "@/components/ui/BracketButton";
import { TimeField, type Ampm, type TimeValue } from "@/components/ui/TimeField";
import { RecurringPicker } from "./RecurringPicker";
import { ReminderPicker } from "./ReminderPicker";
import { ItemFieldsForm } from "./ItemFieldsForm";
import { ItemStatusField } from "./ItemStatusField";
import { ItemBucketField, type BucketChoice } from "./ItemBucketField";
import { ItemAssigneeField, type AssigneeChoice } from "./ItemAssigneeField";
import { ItemDialogFrame } from "./ItemDialogFrame";
import { ItemPageFrame } from "./ItemPageFrame";
import { ItemTitleField } from "./ItemTitleField";
import { useTitleDate } from "./useTitleDate";
import type { RecurringConfig, StatusDef, FieldDef } from "@/types/rules";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useScrollToFirst } from "@/hooks/useScrollToFirst";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  buildDeadline,
  deadlineDate,
  defaultTimeFor,
  lastDayOfMonth,
  timeOfDeadline,
} from "@/lib/time";
import { isLastDayRepeat } from "@/lib/items/occurrence";
import { MOBILE_MEDIA_QUERY } from "@/constants";

const LABEL = "text-muted-foreground font-mono text-xs";

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
  onConfirm: (title?: string) => void;
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
  const titleDate = useTitleDate({
    active: mode === "add",
    title,
    deadline,
    onDeadlineChange: (next) => {
      onDeadlineChange(next);
      setTime(timeOfDeadline(next));
    },
  });
  const resetTitleDate = titleDate.reset;

  const hasFields = !!(fields && fields.length > 0);

  const datePart = deadlineDate(deadline);
  const hasDate = datePart.length > 0;

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
      setTime(timeOfDeadline(deadline));
    }, 0);
    return () => clearTimeout(id);
  }, [open, deadline, resetTitleDate]);

  function handleTitleChange(next: string) {
    onTitleChange(next);
    titleDate.typed(next);
  }

  function handleDateChange(newDate: string) {
    titleDate.pickByHand();
    const date = newDate && isLastDayRepeat(recurring) ? lastDayOfMonth(newDate) : newDate;
    const time = deadline ? { hour: timeHour, min: timeMin, ampm: timeAmpm } : defaultTimeFor(date);
    if (!deadline) setTime(time);
    onDeadlineChange(buildDeadline(date, time.hour, time.min, time.ampm));
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
    onDeadlineChange(buildDeadline(lastDayOfMonth(datePart), timeHour, timeMin, timeAmpm));
  }

  function handleTimeChange(time: TimeValue) {
    titleDate.pickByHand();
    setTime(time);
    if (datePart) onDeadlineChange(buildDeadline(datePart, time.hour, time.min, time.ampm));
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
    onConfirm(titleDate.match?.title);
  }

  const titleHasError = validationAttempted && !title.trim();
  const mention =
    assigneeChoice && assigneeChoice.members.length > 1
      ? { members: assigneeChoice.members, onPick: assigneeChoice.onChange }
      : undefined;

  const whenAndStatus = (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>when</label>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <DatePicker value={datePart} onChange={handleDateChange} disabled={pending} />
          </div>
          {hasDate && (
            <TimeField
              value={{ hour: timeHour, min: timeMin, ampm: timeAmpm }}
              onChange={handleTimeChange}
              allowAllDay
              disabled={pending}
            />
          )}
          {hasDate && !pending && (
            <button
              type="button"
              onClick={() => handleDateChange("")}
              aria-label="remove date"
              className="text-muted-foreground hover:text-destructive -mr-1 shrink-0 p-1 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {hasDate && onRemindersChange && bucketReminders && (
        <ReminderPicker
          reminders={reminders ?? bucketReminders}
          followsBucket={!reminders}
          allDay={!deadline.includes("T")}
          disabled={pending}
          onChange={onRemindersChange}
        />
      )}

      {hasDate && onRecurringChange && (
        <RecurringPicker
          recurring={recurring}
          deadlineDay={Number(datePart.slice(8, 10))}
          initialShowEndDate={!!recurring?.endDate}
          disabled={pending}
          onChange={handleRecurringChange}
        />
      )}

      <ItemStatusField
        status={status}
        statuses={statuses}
        onChange={onStatusChange}
        disabled={pending}
      />
    </>
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

      {assigneeChoice && assigneeChoice.members.length > 1 && (
        <ItemAssigneeField choice={assigneeChoice} disabled={pending} />
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
