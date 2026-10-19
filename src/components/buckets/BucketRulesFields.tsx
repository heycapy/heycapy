import type { Dispatch, SetStateAction } from "react";
import { cn, toggled } from "@/lib/utils";
import type { FollowableSetting, NotificationDefaults } from "@/types/rules";
import { BucketRulesPanel } from "./BucketRulesPanel";
import { FollowTag } from "./FollowTag";
import type { BucketSettingsValues } from "./parseBucketSettings";
import { LOCKED_CONTROLS } from "./constants";
import { HINT } from "@/components/layout/settings-constants";

const FOLLOWED_BY: Partial<Record<keyof BucketSettingsValues, FollowableSetting>> = {
  defaultReminders: "defaultReminders",
  notifyAt: "notifyAt",
  repeat: "repeat",
  notifyWhenOverdue: "overdue",
  overdueRepeatHours: "overdue",
  overdueFirstAlertMins: "overdue",
};

function fromTweaks(key: FollowableSetting, defaults: NotificationDefaults) {
  switch (key) {
    case "overdue":
      return {
        notifyWhenOverdue: defaults.notifyWhenOverdue,
        overdueRepeatHours: defaults.overdueRepeatHours,
        overdueFirstAlertMins: defaults.overdueFirstAlertMins,
      };
    default:
      return { [key]: defaults[key] };
  }
}

type BucketRulesFieldsProps = {
  activeTab: "items" | "notifications";
  values: BucketSettingsValues;
  setValues: Dispatch<SetStateAction<BucketSettingsValues>>;
  clocksDiffer: boolean;
  disabled: boolean;
  locked: boolean;
  // The owner's tweaks, once loaded
  defaults?: NotificationDefaults;
};

export function BucketRulesFields({
  activeTab,
  values,
  setValues,
  clocksDiffer,
  disabled,
  locked,
  defaults,
}: BucketRulesFieldsProps) {
  function set<K extends keyof BucketSettingsValues>(key: K, value: BucketSettingsValues[K]) {
    const followed = FOLLOWED_BY[key];
    setValues((prev) => ({
      ...prev,
      [key]: value,
      followsTweaks: prev.followsTweaks.filter((k) => k !== followed),
    }));
  }

  function followTweaks(key: FollowableSetting) {
    if (!defaults) return;
    setValues((prev) => ({
      ...prev,
      ...fromTweaks(key, defaults),
      followsTweaks: [...prev.followsTweaks, key],
    }));
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
      tagFor={
        locked
          ? undefined
          : (key) => (
              <FollowTag
                following={values.followsTweaks.includes(key)}
                onUseTweaks={() => followTweaks(key)}
                disabled={disabled || !defaults}
              />
            )
      }
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
      aria-label="set by the owner"
      className={cn(
        "border-border flex min-w-0 flex-col gap-4 border border-dashed p-3",
        LOCKED_CONTROLS
      )}
    >
      <p className={HINT}>set by the owner</p>
      {panel}
    </fieldset>
  );
}
