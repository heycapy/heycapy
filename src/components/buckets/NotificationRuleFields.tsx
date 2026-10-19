import type { ReactNode } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { OptionButton } from "@/components/ui/OptionButton";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { TimePicker } from "@/components/ui/TimePicker";
import { OVERDUE_FIRST_ALERT_DEFAULT_MINS } from "@/lib/reminders/constants";
import type { FollowableSetting } from "@/types/rules";
import { ReminderPicker } from "./ReminderPicker";
import { REPEAT_OPTIONS, type RepeatMode } from "./constants";
import { HINT, LABEL } from "@/components/layout/settings-constants";

const OVERDUE_REPEAT_OPTIONS = [
  { value: "0.25", label: "15 min" },
  { value: "0.5", label: "30 min" },
  { value: "1", label: "1 hour" },
  { value: "2", label: "2 hours" },
  { value: "4", label: "4 hours" },
  { value: "8", label: "8 hours" },
] as const;

const OVERDUE_FIRST_ALERT_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 1440, label: "1 day" },
] as const;

// Shown next to a setting's name, bucket settings use it for "from tweaks" / "use tweaks"
export type FollowTagFor = (key: FollowableSetting) => ReactNode;

function LabelRow({ label, tag }: { label: string; tag?: ReactNode }) {
  return (
    <div data-label-row className="flex items-center justify-between gap-2">
      <label className={LABEL}>{label}</label>
      {tag}
    </div>
  );
}

type WhenToRemindFieldsProps = {
  defaultReminders: number[];
  notifyAt: string;
  repeat: RepeatMode;
  clocksDiffer?: boolean;
  disabled?: boolean;
  tagFor?: FollowTagFor;
  onDefaultRemindersChange: (v: number[]) => void;
  onNotifyAtChange: (v: string) => void;
  onRepeatChange: (v: RepeatMode) => void;
};

export function WhenToRemindFields({
  defaultReminders,
  notifyAt,
  repeat,
  clocksDiffer,
  disabled,
  tagFor,
  onDefaultRemindersChange,
  onNotifyAtChange,
  onRepeatChange,
}: WhenToRemindFieldsProps) {
  return (
    <>
      <ReminderPicker
        reminders={defaultReminders}
        hint="how long before the deadline you get reminded. you can pick different ones on a single item"
        allDay={false}
        disabled={disabled}
        labelTag={tagFor?.("defaultReminders")}
        onChange={onDefaultRemindersChange}
      />
      <div className="flex flex-col gap-1.5">
        <LabelRow label="remind at" tag={tagFor?.("notifyAt")} />
        <span className={HINT}>
          all-day items are reminded at this time, and nothing from the bucket arrives earlier in
          the day
          {clocksDiffer && " · each person gets this on their own clock"}
        </span>
        <TimePicker value={notifyAt} onChange={onNotifyAtChange} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5">
        <LabelRow label="keep reminding" tag={tagFor?.("repeat")} />
        <span className={HINT}>
          daily sends the reminder again every day until the item is done
        </span>
        <OptionGroup
          options={REPEAT_OPTIONS}
          value={repeat}
          onChange={onRepeatChange}
          disabled={disabled}
        />
      </div>
    </>
  );
}

type OverdueFieldsProps = {
  notifyWhenOverdue: boolean;
  overdueRepeatHours: number | undefined;
  overdueFirstAlertMins: number | undefined;
  disabled?: boolean;
  tagFor?: FollowTagFor;
  onNotifyWhenOverdueChange: (v: boolean) => void;
  onOverdueRepeatHoursChange: (v: number | undefined) => void;
  onOverdueFirstAlertMinsChange: (v: number) => void;
};

export function OverdueFields({
  notifyWhenOverdue,
  overdueRepeatHours,
  overdueFirstAlertMins,
  disabled,
  tagFor,
  onNotifyWhenOverdueChange,
  onOverdueRepeatHoursChange,
  onOverdueFirstAlertMinsChange,
}: OverdueFieldsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <LabelRow label="notify when overdue" tag={tagFor?.("overdue")} />
      <span className={HINT}>alert when an item passes its deadline and isn&apos;t done</span>
      <Toggle value={notifyWhenOverdue} onChange={onNotifyWhenOverdueChange} disabled={disabled} />
      {notifyWhenOverdue && (
        <div className="mt-1.5 flex flex-col gap-3">
          <div role="group" aria-label="first alert" className="flex flex-col gap-1.5">
            <span className={LABEL}>first alert</span>
            <span className={HINT}>how long after the deadline</span>
            <div className="flex flex-wrap gap-1.5">
              {OVERDUE_FIRST_ALERT_OPTIONS.map((opt) => (
                <OptionButton
                  key={opt.value}
                  active={(overdueFirstAlertMins ?? OVERDUE_FIRST_ALERT_DEFAULT_MINS) === opt.value}
                  disabled={disabled}
                  onClick={() => onOverdueFirstAlertMinsChange(opt.value)}
                >
                  {opt.label}
                </OptionButton>
              ))}
            </div>
          </div>
          <div role="group" aria-label="then repeat every" className="flex flex-col gap-1.5">
            <span className={LABEL}>then repeat every</span>
            <span className={HINT}>pick none to alert just once</span>
            <div className="flex flex-wrap gap-1.5">
              {OVERDUE_REPEAT_OPTIONS.map((opt) => {
                const active = String(overdueRepeatHours) === opt.value;
                return (
                  <OptionButton
                    key={opt.value}
                    active={active}
                    disabled={disabled}
                    onClick={() =>
                      onOverdueRepeatHoursChange(active ? undefined : parseFloat(opt.value))
                    }
                  >
                    {opt.label}
                  </OptionButton>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
