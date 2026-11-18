"use client";

import { useState, type ReactNode } from "react";
import { describeReminder } from "@/lib/items/reminder-label";
import { describeRepeat } from "@/lib/items/repeat-label";
import type { FieldDef, RecurringConfig, StatusDef } from "@/types/rules";
import { DetailChip } from "./DetailChip";
import { ItemFieldChipPanel } from "./ItemFieldChipPanel";
import { ItemStatusField } from "./ItemStatusField";
import { RecurringPicker } from "./RecurringPicker";
import { ReminderPicker } from "./ReminderPicker";
import {
  DETAIL_EDITOR as EDITOR,
  FIELD_LABEL,
  NEEDS_DATE,
  type DetailPanelId,
  type ItemDetailPanel,
} from "./constants";

export type FieldChip = {
  key: string;
  name: string;
  label: string;
  prefix?: string;
  required: boolean;
  set: boolean;
  invalid: boolean;
  field: FieldDef;
  value: unknown;
};

type ItemDetailsProps = {
  dateSlot: ReactNode;
  datePart: string;
  allDay: boolean;
  clock?: ReactNode;
  withStatus: boolean;
  status: string;
  statuses: StatusDef[];
  recurring?: RecurringConfig | null;
  reminders?: number[] | null;
  bucketReminders?: number[];
  assignee?: { label: string; set: boolean; field: ReactNode };
  fieldChips?: FieldChip[];
  onFieldChange?: (key: string, value: unknown) => void;
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
  dateSlot,
  datePart,
  allDay,
  clock,
  withStatus,
  status,
  statuses,
  recurring,
  reminders,
  bucketReminders,
  assignee,
  fieldChips,
  onFieldChange,
  onStatusChange,
  onRecurringChange,
  onRemindersChange,
}: ItemDetailsProps) {
  const [panel, setPanel] = useState<DetailPanelId | null>(null);
  const hasDate = datePart.length > 0;
  const reminderList = reminders ?? bucketReminders ?? [];
  const statusDef = statuses.find((s) => s.name === status);

  function toggle(next: ItemDetailPanel, needsDate = false) {
    if (needsDate && !hasDate) return;
    setPanel((current) => (current === next ? null : next));
  }

  function toggleField(key: string) {
    const id: DetailPanelId = `field:${key}`;
    setPanel((current) => (current === id ? null : id));
  }

  function closeField(key: string) {
    setPanel(null);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-inline-edit] [data-field-key="${key}"]`)?.focus()
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="item details" className="flex flex-wrap gap-1.5">
        {dateSlot}
        {onRecurringChange && (
          <DetailChip
            name="repeat"
            icon="reload"
            label={hasDate && recurring?.enabled ? describeRepeat(recurring) : "repeat"}
            set={hasDate && !!recurring?.enabled}
            open={panel === "repeat"}
            hint={hasDate ? undefined : NEEDS_DATE}
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
            hint={hasDate ? undefined : NEEDS_DATE}
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
      </div>

      {hasDate && clock}

      {panel === "repeat" && hasDate && onRecurringChange && (
        <div className={EDITOR}>
          <RecurringPicker
            recurring={recurring}
            deadlineDay={Number(datePart.slice(8, 10))}
            initialShowEndDate={!!recurring?.endDate}
            onChange={onRecurringChange}
          />
        </div>
      )}

      {panel === "reminders" && hasDate && onRemindersChange && bucketReminders && (
        <div className={EDITOR}>
          <ReminderPicker
            reminders={reminderList}
            followsBucket={!reminders}
            allDay={allDay}
            onChange={onRemindersChange}
          />
        </div>
      )}

      {panel === "assignee" && assignee && <div className={EDITOR}>{assignee.field}</div>}

      {panel === "status" && (
        <div className={EDITOR}>
          <ItemStatusField status={status} statuses={statuses} onChange={onStatusChange} />
        </div>
      )}

      {fieldChips && fieldChips.length > 0 && (
        <div className="flex flex-col gap-3 pt-1">
          <p className={FIELD_LABEL}>fields</p>
          <div role="group" aria-label="item fields" className="flex flex-wrap gap-1.5">
            {fieldChips.map((chip) => (
              <DetailChip
                key={chip.key}
                fieldKey={chip.key}
                name={chip.name}
                label={chip.label}
                prefix={chip.prefix}
                required={chip.required}
                set={chip.set}
                invalid={chip.invalid}
                open={panel === `field:${chip.key}`}
                onClick={() => toggleField(chip.key)}
              />
            ))}
          </div>
          {fieldChips.map(
            (chip) =>
              panel === `field:${chip.key}` && (
                <div key={chip.key} className={EDITOR}>
                  <ItemFieldChipPanel
                    field={chip.field}
                    value={chip.value}
                    invalid={chip.invalid}
                    onChange={(next) => onFieldChange?.(chip.key, next)}
                    onDone={() => closeField(chip.key)}
                  />
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
