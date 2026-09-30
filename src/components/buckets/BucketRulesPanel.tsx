import {
  QUICK_REMIND_VALUES,
  reminderButtonLabel,
  type QuickRemindChoice,
} from "@/lib/notifications/constants";
import { Toggle } from "@/components/ui/Toggle";
import { OptionButton } from "@/components/ui/OptionButton";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { TimePicker } from "@/components/ui/TimePicker";
import { DurationInput } from "@/components/ui/DurationInput";
import { ReminderPicker } from "./ReminderPicker";
import type { SortBy, NotificationMedium, RepeatMode } from "./constants";
import { SORT_OPTIONS, MEDIUM_OPTIONS, REPEAT_OPTIONS, RECURRENCE_MODE_OPTIONS } from "./constants";
import type { RecurrenceMode } from "@/types/rules";
import { OVERDUE_FIRST_ALERT_DEFAULT_MINS } from "@/lib/reminders/constants";

const LABEL = "text-muted-foreground font-mono text-xs";
const HINT = "text-muted-foreground font-mono text-[11px] leading-tight";

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

export type NotifAvailability = { email: boolean; ntfy: boolean; telegram: boolean; push: boolean };

type BucketRulesPanelProps = {
  activeTab: "items" | "notifications";
  disabled?: boolean;
  sortBy: SortBy;
  drag: boolean;
  showCompleted: boolean;
  recurrenceMode: RecurrenceMode;
  readonly: boolean;
  defaultDeadlineOffset: string;
  mediums: NotificationMedium[];
  reminderButtons: QuickRemindChoice[];
  notifyAt: string;
  defaultReminders: number[];
  repeat: RepeatMode;
  notifyOnArrival: boolean;
  notifyWhenOverdue: boolean;
  overdueRepeatHours: number | undefined;
  overdueFirstAlertMins: number | undefined;
  onSortByChange: (v: SortBy) => void;
  onDragChange: (v: boolean) => void;
  onShowCompletedChange: (v: boolean) => void;
  onRecurrenceModeChange: (v: RecurrenceMode) => void;
  onReadonlyChange: (v: boolean) => void;
  onDefaultDeadlineOffsetChange: (v: string) => void;
  onMediumToggle: (m: NotificationMedium) => void;
  onReminderButtonToggle: (b: QuickRemindChoice) => void;
  onNotifyAtChange: (v: string) => void;
  onDefaultRemindersChange: (v: number[]) => void;
  onRepeatChange: (v: RepeatMode) => void;
  onNotifyOnArrivalChange: (v: boolean) => void;
  onNotifyWhenOverdueChange: (v: boolean) => void;
  onOverdueRepeatHoursChange: (v: number | undefined) => void;
  onOverdueFirstAlertMinsChange: (v: number) => void;
  notifAvailability?: NotifAvailability;
};

export function BucketRulesPanel({
  activeTab,
  disabled,
  sortBy,
  drag,
  showCompleted,
  recurrenceMode,
  readonly,
  defaultDeadlineOffset,
  mediums,
  reminderButtons,
  notifyAt,
  defaultReminders,
  repeat,
  notifyOnArrival,
  notifyWhenOverdue,
  overdueRepeatHours,
  overdueFirstAlertMins,
  onSortByChange,
  onDragChange,
  onShowCompletedChange,
  onRecurrenceModeChange,
  onReadonlyChange,
  onDefaultDeadlineOffsetChange,
  onMediumToggle,
  onReminderButtonToggle,
  onNotifyAtChange,
  onDefaultRemindersChange,
  onRepeatChange,
  onNotifyOnArrivalChange,
  onNotifyWhenOverdueChange,
  onOverdueRepeatHoursChange,
  onOverdueFirstAlertMinsChange,
  notifAvailability,
}: BucketRulesPanelProps) {
  if (activeTab === "items") {
    return (
      <>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>sort by</label>
          <span className={HINT}>how items are ordered in this bucket</span>
          <OptionGroup options={SORT_OPTIONS} value={sortBy} onChange={onSortByChange} />
        </div>
        {sortBy === "manual" && (
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>allow drag</label>
            <span className={HINT}>let you drag items to reorder them manually</span>
            <Toggle value={drag} onChange={onDragChange} />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>show completed</label>
          <span className={HINT}>keep completed items visible in the list</span>
          <Toggle value={showCompleted} onChange={onShowCompletedChange} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>repeating items</label>
          <span className={HINT}>
            {RECURRENCE_MODE_OPTIONS.find((o) => o.value === recurrenceMode)?.hint}
          </span>
          <OptionGroup
            options={RECURRENCE_MODE_OPTIONS}
            value={recurrenceMode}
            onChange={onRecurrenceModeChange}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>read only</label>
          <span className={HINT}>prevent adding or editing items in this bucket</span>
          <Toggle value={readonly} onChange={onReadonlyChange} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>default deadline offset</label>
          <span className={HINT}>
            when adding an item, pre-fill the deadline this far from today
          </span>
          <DurationInput
            value={defaultDeadlineOffset}
            onChange={onDefaultDeadlineOffsetChange}
            placeholder="e.g. 7 days, 2 weeks"
            disabled={disabled}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>channels</label>
        <span className={HINT}>where to send notifications for this bucket</span>
        <OptionGroup options={MEDIUM_OPTIONS} value={mediums} onChange={onMediumToggle} multi />
        {notifAvailability && mediums.length > 0 && (
          <div className="mt-0.5 flex flex-col gap-0.5">
            {mediums.includes("email") && !notifAvailability.email && (
              <span className="text-warning font-mono text-[11px]">
                ⚠ email not configured — set up in tweaks
              </span>
            )}
            {mediums.includes("ntfy") && !notifAvailability.ntfy && (
              <span className="text-warning font-mono text-[11px]">
                ⚠ ntfy not configured — add server url + topic in tweaks
              </span>
            )}
            {mediums.includes("telegram") && !notifAvailability.telegram && (
              <span className="text-warning font-mono text-[11px]">
                ⚠ telegram not connected — set up in tweaks
              </span>
            )}
            {mediums.includes("push") && !notifAvailability.push && (
              <span className="text-warning font-mono text-[11px]">
                ⚠ push is off on every device — turn it on in tweaks
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>reminder buttons</label>
        <span className={HINT}>
          done is always there; pick when to be reminded again. push (android, desktop) shows done +
          the first one, ntfy done + two, email and telegram all of them
        </span>
        <OptionGroup
          options={QUICK_REMIND_VALUES.map((v) => ({ value: v, label: reminderButtonLabel(v) }))}
          value={reminderButtons}
          onChange={onReminderButtonToggle}
          multi
          disabled={disabled}
        />
      </div>
      <ReminderPicker
        reminders={defaultReminders}
        hint="new items start with these; items whose reminders you've changed keep their own"
        allDay={false}
        disabled={disabled}
        onChange={onDefaultRemindersChange}
      />
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>remind at</label>
        <span className={HINT}>
          the time of day for items without a time; this bucket also never reminds earlier than it
        </span>
        <TimePicker value={notifyAt} onChange={onNotifyAtChange} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>deadline repeat</label>
        <span className={HINT}>
          daily = re-send the deadline reminder every day until the item is completed
        </span>
        <OptionGroup options={REPEAT_OPTIONS} value={repeat} onChange={onRepeatChange} />
      </div>

      <div className="border-border flex flex-col gap-4 border-t pt-4">
        <p className={LABEL}>triggers</p>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>notify on arrival</label>
          <span className={HINT}>
            send a notification every time a new item arrives via webhook
          </span>
          <Toggle value={notifyOnArrival} onChange={onNotifyOnArrivalChange} disabled={disabled} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>notify when overdue</label>
          <span className={HINT}>
            send a notification when an item passes its deadline without being completed
          </span>
          <Toggle
            value={notifyWhenOverdue}
            onChange={onNotifyWhenOverdueChange}
            disabled={disabled}
          />
          {notifyWhenOverdue && (
            <div className="mt-1.5 flex flex-col gap-3">
              <div role="group" aria-label="first alert after" className="flex flex-col gap-1.5">
                <span className={HINT}>first alert after the deadline</span>
                <div className="flex flex-wrap gap-1.5">
                  {OVERDUE_FIRST_ALERT_OPTIONS.map((opt) => (
                    <OptionButton
                      key={opt.value}
                      active={
                        (overdueFirstAlertMins ?? OVERDUE_FIRST_ALERT_DEFAULT_MINS) === opt.value
                      }
                      disabled={disabled}
                      onClick={() => onOverdueFirstAlertMinsChange(opt.value)}
                    >
                      {opt.label}
                    </OptionButton>
                  ))}
                </div>
              </div>
              <div role="group" aria-label="repeat every" className="flex flex-col gap-1.5">
                <span className={HINT}>repeat every — leave unset to notify once</span>
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
      </div>
    </>
  );
}
