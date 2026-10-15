import type { Dispatch, SetStateAction } from "react";
import { cn, toggled } from "@/lib/utils";
import { BucketRulesPanel } from "./BucketRulesPanel";
import type { BucketSettingsValues } from "./parseBucketSettings";
import { LOCKED_CONTROLS } from "./constants";

type BucketRulesFieldsProps = {
  activeTab: "items" | "notifications";
  values: BucketSettingsValues;
  setValues: Dispatch<SetStateAction<BucketSettingsValues>>;
  clocksDiffer: boolean;
  disabled: boolean;
  locked: boolean;
};

export function BucketRulesFields({
  activeTab,
  values,
  setValues,
  clocksDiffer,
  disabled,
  locked,
}: BucketRulesFieldsProps) {
  function set<K extends keyof BucketSettingsValues>(key: K, value: BucketSettingsValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const panel = (
    <BucketRulesPanel
      activeTab={activeTab}
      disabled={disabled}
      sortBy={values.sortBy}
      drag={values.drag}
      showCompleted={values.showCompleted}
      recurrenceMode={values.recurrenceMode}
      readonly={values.readonly}
      defaultDeadlineOffset={values.defaultDeadlineOffset}
      reminderButtons={values.reminderButtons}
      notifyAt={values.notifyAt}
      clocksDiffer={clocksDiffer}
      defaultReminders={values.defaultReminders}
      repeat={values.repeat}
      notifyOnArrival={values.notifyOnArrival}
      notifyWhenOverdue={values.notifyWhenOverdue}
      overdueRepeatHours={values.overdueRepeatHours}
      overdueFirstAlertMins={values.overdueFirstAlertMins}
      onSortByChange={(v) => set("sortBy", v)}
      onDragChange={(v) => set("drag", v)}
      onShowCompletedChange={(v) => set("showCompleted", v)}
      onRecurrenceModeChange={(v) => set("recurrenceMode", v)}
      onReadonlyChange={(v) => set("readonly", v)}
      onDefaultDeadlineOffsetChange={(v) => set("defaultDeadlineOffset", v)}
      onReminderButtonToggle={(b) =>
        setValues((prev) => ({ ...prev, reminderButtons: toggled(prev.reminderButtons, b) }))
      }
      onNotifyAtChange={(v) => set("notifyAt", v)}
      onDefaultRemindersChange={(v) => set("defaultReminders", v)}
      onRepeatChange={(v) => set("repeat", v)}
      onNotifyOnArrivalChange={(v) => set("notifyOnArrival", v)}
      onNotifyWhenOverdueChange={(v) => set("notifyWhenOverdue", v)}
      onOverdueRepeatHoursChange={(v) => set("overdueRepeatHours", v)}
      onOverdueFirstAlertMinsChange={(v) => set("overdueFirstAlertMins", v)}
    />
  );

  if (!locked) return panel;
  return (
    <fieldset
      disabled
      className={cn(
        "border-border flex min-w-0 flex-col gap-4 border border-dashed px-3 pt-1 pb-3",
        LOCKED_CONTROLS
      )}
    >
      <legend className="text-muted-foreground px-1 font-mono text-[11px]">set by the owner</legend>
      {panel}
    </fieldset>
  );
}
