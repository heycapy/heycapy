import {
  QUICK_REMIND_VALUES,
  reminderButtonLabel,
  type QuickRemindChoice,
} from "@/lib/notifications/constants";
import { Toggle } from "@/components/ui/Toggle";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { DurationInput } from "@/components/ui/DurationInput";
import { OverdueFields, WhenToRemindFields, type FollowTagFor } from "./NotificationRuleFields";
import type { SortBy, RepeatMode } from "./constants";
import { SORT_OPTIONS, RECURRENCE_MODE_OPTIONS } from "./constants";
import type { RecurrenceMode } from "@/types/rules";
import { BOX, SECTION, HINT, LABEL } from "@/components/layout/settings-constants";

type BucketRulesPanelProps = {
  activeTab: "items" | "notifications";
  disabled?: boolean;
  sortBy: SortBy;
  drag: boolean;
  showCompleted: boolean;
  recurrenceMode: RecurrenceMode;
  readonly: boolean;
  defaultDeadlineOffset: string;
  reminderButtons: QuickRemindChoice[];
  notifyAt: string;
  clocksDiffer: boolean;
  defaultReminders: number[];
  repeat: RepeatMode;
  notifyOnArrival: boolean;
  notifyWhenOverdue: boolean;
  overdueRepeatHours: number | undefined;
  overdueFirstAlertMins: number | undefined;
  tagFor?: FollowTagFor;
  onSortByChange: (v: SortBy) => void;
  onDragChange: (v: boolean) => void;
  onShowCompletedChange: (v: boolean) => void;
  onRecurrenceModeChange: (v: RecurrenceMode) => void;
  onReadonlyChange: (v: boolean) => void;
  onDefaultDeadlineOffsetChange: (v: string) => void;
  onReminderButtonToggle: (b: QuickRemindChoice) => void;
  onNotifyAtChange: (v: string) => void;
  onDefaultRemindersChange: (v: number[]) => void;
  onRepeatChange: (v: RepeatMode) => void;
  onNotifyOnArrivalChange: (v: boolean) => void;
  onNotifyWhenOverdueChange: (v: boolean) => void;
  onOverdueRepeatHoursChange: (v: number | undefined) => void;
  onOverdueFirstAlertMinsChange: (v: number) => void;
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
  reminderButtons,
  notifyAt,
  clocksDiffer,
  defaultReminders,
  repeat,
  notifyOnArrival,
  notifyWhenOverdue,
  overdueRepeatHours,
  overdueFirstAlertMins,
  tagFor,
  onSortByChange,
  onDragChange,
  onShowCompletedChange,
  onRecurrenceModeChange,
  onReadonlyChange,
  onDefaultDeadlineOffsetChange,
  onReminderButtonToggle,
  onNotifyAtChange,
  onDefaultRemindersChange,
  onRepeatChange,
  onNotifyOnArrivalChange,
  onNotifyWhenOverdueChange,
  onOverdueRepeatHoursChange,
  onOverdueFirstAlertMinsChange,
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
      <div className={BOX}>
        <span className={SECTION}>when to remind</span>
        <WhenToRemindFields
          defaultReminders={defaultReminders}
          notifyAt={notifyAt}
          repeat={repeat}
          clocksDiffer={clocksDiffer}
          disabled={disabled}
          tagFor={tagFor}
          onDefaultRemindersChange={onDefaultRemindersChange}
          onNotifyAtChange={onNotifyAtChange}
          onRepeatChange={onRepeatChange}
        />
      </div>

      <div className={BOX}>
        <span className={SECTION}>if it&apos;s overdue</span>
        <OverdueFields
          notifyWhenOverdue={notifyWhenOverdue}
          overdueRepeatHours={overdueRepeatHours}
          overdueFirstAlertMins={overdueFirstAlertMins}
          disabled={disabled}
          tagFor={tagFor}
          onNotifyWhenOverdueChange={onNotifyWhenOverdueChange}
          onOverdueRepeatHoursChange={onOverdueRepeatHoursChange}
          onOverdueFirstAlertMinsChange={onOverdueFirstAlertMinsChange}
        />
      </div>

      <div className={BOX}>
        <span className={SECTION}>reminder buttons</span>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>remind me again in</label>
          <span className={HINT}>
            every reminder has a done button, plus the snooze times you pick here. phone push only
            fits the first one, ntfy the first two, email and telegram show all of them
          </span>
          <OptionGroup
            options={QUICK_REMIND_VALUES.map((v) => ({ value: v, label: reminderButtonLabel(v) }))}
            value={reminderButtons}
            onChange={onReminderButtonToggle}
            multi
            disabled={disabled}
          />
        </div>
      </div>

      <div className={BOX}>
        <span className={SECTION}>webhook items</span>
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>notify on arrival</label>
          <span className={HINT}>send a notification when a webhook adds an item</span>
          <Toggle value={notifyOnArrival} onChange={onNotifyOnArrivalChange} disabled={disabled} />
        </div>
      </div>
    </>
  );
}
