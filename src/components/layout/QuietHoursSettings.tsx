import { Toggle } from "@/components/ui/Toggle";
import { TimePicker } from "@/components/ui/TimePicker";
import { formatSlot } from "@/lib/format-date";
import { BOX, LABEL, SECTION } from "./settings-constants";

const HINT = "text-muted-foreground font-mono text-[11px]";

export type QuietHours = { enabled: boolean; from: string; to: string };

type QuietHoursSettingsProps = {
  value: QuietHours;
  onChange: (value: QuietHours) => void;
  pending: boolean;
};

export function QuietHoursSettings({ value, onChange, pending }: QuietHoursSettingsProps) {
  const { enabled, from, to } = value;
  return (
    <div className={BOX}>
      <span className={SECTION}>quiet hours</span>
      <div className="flex items-center justify-between">
        <label className={LABEL}>don&apos;t send anything at night</label>
        <Toggle
          value={enabled}
          onChange={(on) => onChange({ ...value, enabled: on })}
          disabled={pending}
        />
      </div>
      {enabled && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className={LABEL}>from</span>
            <TimePicker
              value={from}
              onChange={(v) => onChange({ ...value, from: v })}
              disabled={pending}
            />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={LABEL}>to</span>
            <TimePicker
              value={to}
              onChange={(v) => onChange({ ...value, to: v })}
              disabled={pending}
            />
          </div>
        </div>
      )}
      <p className={HINT}>
        {enabled
          ? `nothing is sent ${formatSlot(from)}–${formatSlot(to)}, on any channel; reminders due then arrive at ${formatSlot(to)}`
          : "reminders and alerts can arrive at any time"}
      </p>
    </div>
  );
}
