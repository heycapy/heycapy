import { OptionButton } from "@/components/ui/OptionButton";
import { Toggle } from "@/components/ui/Toggle";
import { OverdueFields, WhenToRemindFields } from "@/components/buckets/NotificationRuleFields";
import { MEDIUM_OPTIONS } from "@/components/buckets/constants";
import { toggled } from "@/lib/utils";
import type { NotificationDefaults } from "@/types/rules";
import { BOX, LABEL, SECTION, HINT } from "./settings-constants";

// where, when to remind and if it's overdue, the sections a bucket's own settings have
const GROUP = "border-border flex flex-col gap-3 border-t pt-3";

type BucketDefaultsSettingsProps = {
  value: NotificationDefaults;
  onChange: (v: NotificationDefaults) => void;
  workingChannels: NonNullable<NotificationDefaults["medium"]>;
  pending: boolean;
};

export function BucketDefaultsSettings({
  value,
  onChange,
  workingChannels,
  pending,
}: BucketDefaultsSettingsProps) {
  function set<K extends keyof NotificationDefaults>(key: K, v: NotificationDefaults[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className={BOX} role="group" aria-label="bucket defaults">
      <span className={SECTION}>bucket defaults</span>
      <p className={HINT}>
        every bucket uses these until you change one in its own settings. buckets you already had
        keep their own, press use tweaks in their settings to follow these instead
      </p>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className={LABEL}>every channel you set up</label>
          <Toggle
            value={value.medium === null}
            onChange={(all) => set("medium", all ? null : workingChannels)}
            disabled={pending}
          />
        </div>
        <span className={HINT}>
          {value.medium === null
            ? "a new bucket gets every channel working at that moment"
            : "the channels buckets use"}
          {" · other apps follow their own on by default switch"}
        </span>
        {value.medium !== null && (
          <div role="group" aria-label="default channels" className="flex flex-wrap gap-1.5">
            {MEDIUM_OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                active={value.medium?.includes(option.value) ?? false}
                disabled={pending}
                onClick={() => set("medium", toggled(value.medium ?? [], option.value))}
              >
                {option.label}
              </OptionButton>
            ))}
          </div>
        )}
      </div>

      <div className={GROUP}>
        <WhenToRemindFields
          defaultReminders={value.defaultReminders}
          notifyAt={value.notifyAt}
          repeat={value.repeat}
          disabled={pending}
          onDefaultRemindersChange={(v) => set("defaultReminders", v)}
          onNotifyAtChange={(v) => set("notifyAt", v)}
          onRepeatChange={(v) => set("repeat", v)}
        />
      </div>
      <div className={GROUP}>
        <OverdueFields
          notifyWhenOverdue={value.notifyWhenOverdue}
          overdueRepeatHours={value.overdueRepeatHours}
          overdueFirstAlertMins={value.overdueFirstAlertMins}
          disabled={pending}
          onNotifyWhenOverdueChange={(v) => set("notifyWhenOverdue", v)}
          onOverdueRepeatHoursChange={(v) => set("overdueRepeatHours", v)}
          onOverdueFirstAlertMinsChange={(v) => set("overdueFirstAlertMins", v)}
        />
      </div>
    </div>
  );
}
