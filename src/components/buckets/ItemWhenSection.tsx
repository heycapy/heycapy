import type { ReactNode } from "react";
import { X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimeField, type TimeValue } from "@/components/ui/TimeField";
import { RecurringPicker } from "./RecurringPicker";
import { ReminderPicker } from "./ReminderPicker";
import { ItemStatusField } from "./ItemStatusField";
import type { RecurringConfig, StatusDef } from "@/types/rules";

const LABEL = "text-muted-foreground font-mono text-xs";

type ItemWhenSectionProps = {
  datePart: string;
  allDay: boolean;
  time: TimeValue;
  clock?: ReactNode;
  status: string;
  statuses: StatusDef[];
  recurring?: RecurringConfig | null;
  reminders?: number[] | null;
  bucketReminders?: number[];
  pending?: boolean;
  onDateChange: (date: string) => void;
  onTimeChange: (time: TimeValue) => void;
  onStatusChange: (v: string) => void;
  onRecurringChange?: (v: RecurringConfig | null) => void;
  onRemindersChange?: (v: number[]) => void;
};

export function ItemWhenSection({
  datePart,
  allDay,
  time,
  clock,
  status,
  statuses,
  recurring,
  reminders,
  bucketReminders,
  pending,
  onDateChange,
  onTimeChange,
  onStatusChange,
  onRecurringChange,
  onRemindersChange,
}: ItemWhenSectionProps) {
  const hasDate = datePart.length > 0;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>when</label>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <DatePicker value={datePart} onChange={onDateChange} disabled={pending} />
          </div>
          {hasDate && (
            <TimeField value={time} onChange={onTimeChange} allowAllDay disabled={pending} />
          )}
          {hasDate && !pending && (
            <button
              type="button"
              onClick={() => onDateChange("")}
              aria-label="remove date"
              className="text-muted-foreground hover:text-destructive -mr-1 shrink-0 p-1 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>
        {hasDate && clock}
      </div>

      {hasDate && onRemindersChange && bucketReminders && (
        <ReminderPicker
          reminders={reminders ?? bucketReminders}
          followsBucket={!reminders}
          allDay={allDay}
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
          onChange={onRecurringChange}
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
}
