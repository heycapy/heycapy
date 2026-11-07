"use client";

import { useState, type ReactNode } from "react";
import { Calendar } from "@/components/ui/Calendar";
import { formatDisplay } from "@/components/ui/DatePicker";
import { TextButton } from "@/components/ui/TextButton";
import { TimeField, timeLabel, type TimeValue } from "@/components/ui/TimeField";
import { describeReminder } from "@/lib/items/reminder-label";
import { describeRepeat } from "@/lib/items/repeat-label";
import type { RecurringConfig, StatusDef } from "@/types/rules";
import { DetailChip } from "./DetailChip";
import { ItemStatusField } from "./ItemStatusField";
import { RecurringPicker } from "./RecurringPicker";
import { ReminderPicker } from "./ReminderPicker";
import type { ItemDetailPanel } from "./constants";

type ItemDetailsProps = {
  datePart: string;
  allDay: boolean;
  time: TimeValue;
  clock?: ReactNode;
  withStatus: boolean;
  status: string;
  statuses: StatusDef[];
  recurring?: RecurringConfig | null;
  reminders?: number[] | null;
  bucketReminders?: number[];
  assignee?: { label: string; set: boolean; field: ReactNode };
  more?: ReactNode;
  showMore: boolean;
  pending?: boolean;
  onDateChange: (date: string) => void;
  onTimeChange: (time: TimeValue) => void;
  onStatusChange: (v: string) => void;
  onRecurringChange?: (v: RecurringConfig | null) => void;
  onRemindersChange?: (v: number[]) => void;
};

function remindersLabel(list: number[], allDay: boolean): string {
  if (list.length === 0) return "no reminders";
  if (list.length === 1) return describeReminder(list[0] ?? 0, allDay);
  return `${list.length} reminders`;
}

export function ItemDetails({
  datePart,
  allDay,
  time,
  clock,
  withStatus,
  status,
  statuses,
  recurring,
  reminders,
  bucketReminders,
  assignee,
  more,
  showMore,
  pending,
  onDateChange,
  onTimeChange,
  onStatusChange,
  onRecurringChange,
  onRemindersChange,
}: ItemDetailsProps) {
  const [panel, setPanel] = useState<ItemDetailPanel | null>(null);
  const hasDate = datePart.length > 0;
  const reminderList = reminders ?? bucketReminders ?? [];
  const statusDef = statuses.find((s) => s.name === status);

  function toggle(next: ItemDetailPanel, needsDate = false) {
    if (needsDate && !hasDate) return setPanel("date");
    setPanel((current) => (current === next ? null : next));
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="item details" className="flex flex-wrap gap-1.5">
        <DetailChip
          name="date"
          icon="calendar"
          label={hasDate ? `${formatDisplay(datePart)} · ${timeLabel(time)}` : "date"}
          set={hasDate}
          open={panel === "date"}
          onClick={() => toggle("date")}
        />
        {onRecurringChange && (
          <DetailChip
            name="repeat"
            icon="reload"
            label={hasDate && recurring?.enabled ? describeRepeat(recurring) : "repeat"}
            set={hasDate && !!recurring?.enabled}
            open={panel === "repeat"}
            onClick={() => toggle("repeat", true)}
          />
        )}
        {onRemindersChange && bucketReminders && (
          <DetailChip
            name="reminders"
            icon="bell"
            label={hasDate ? remindersLabel(reminderList, allDay) : "reminders"}
            set={hasDate && reminderList.length > 0}
            open={panel === "reminders"}
            onClick={() => toggle("reminders", true)}
          />
        )}
        {assignee && (
          <DetailChip
            name="assignee"
            icon="user-plus"
            label={assignee.label}
            set={assignee.set}
            open={panel === "assignee"}
            onClick={() => toggle("assignee")}
          />
        )}
        {withStatus && (
          <DetailChip
            name="status"
            dot={statusDef?.color}
            label={status}
            set
            open={panel === "status"}
            onClick={() => toggle("status")}
          />
        )}
        {more && !showMore && (
          <DetailChip
            name="more"
            icon="more"
            label="more"
            set={false}
            open={panel === "more"}
            onClick={() => toggle("more")}
          />
        )}
      </div>

      {hasDate && clock}

      {panel === "date" && (
        <div className="flex flex-col gap-3">
          <div className="max-w-xs">
            <Calendar value={datePart} onSelect={onDateChange} />
          </div>
          {hasDate && (
            <div className="flex items-center gap-2">
              <TimeField value={time} onChange={onTimeChange} allowAllDay disabled={pending} />
              <TextButton
                variant="destructive"
                onClick={() => onDateChange("")}
                disabled={pending}
                className="ml-auto"
              >
                remove date
              </TextButton>
            </div>
          )}
        </div>
      )}

      {panel === "repeat" && hasDate && onRecurringChange && (
        <RecurringPicker
          recurring={recurring}
          deadlineDay={Number(datePart.slice(8, 10))}
          initialShowEndDate={!!recurring?.endDate}
          disabled={pending}
          onChange={onRecurringChange}
        />
      )}

      {panel === "reminders" && hasDate && onRemindersChange && bucketReminders && (
        <ReminderPicker
          reminders={reminderList}
          followsBucket={!reminders}
          allDay={allDay}
          disabled={pending}
          onChange={onRemindersChange}
        />
      )}

      {panel === "assignee" && assignee?.field}

      {panel === "status" && (
        <ItemStatusField
          status={status}
          statuses={statuses}
          onChange={onStatusChange}
          disabled={pending}
        />
      )}

      {(showMore || panel === "more") && more}
    </div>
  );
}
