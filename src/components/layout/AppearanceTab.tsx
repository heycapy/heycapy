import { cn } from "@/lib/utils";
import { charCountColor } from "@/components/ui/input";
import { LABEL, INPUT } from "./settings-constants";
import { TIMEZONE_MAX_LENGTH } from "@/constants";
import { LookPicker } from "./LookPicker";
import { ThemeSwatches } from "./ThemeSwatches";
import { ComfortSettings } from "./ComfortSettings";

type AppearanceTabProps = {
  theme: string | undefined;
  setTheme: (t: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  pending: boolean;
};

export function AppearanceTab({
  theme,
  setTheme,
  timezone,
  setTimezone,
  pending,
}: AppearanceTabProps) {
  return (
    <>
      <LookPicker />
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>theme</label>
        <ThemeSwatches theme={theme} onPick={setTheme} />
      </div>
      <ComfortSettings />
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>timezone</label>
        <input
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="America/New_York"
          maxLength={TIMEZONE_MAX_LENGTH}
          disabled={pending}
          className={INPUT}
        />
        {timezone.length > 0 && (
          <p
            className={cn(
              "font-ui text-2xs mt-0.5 text-right transition-colors",
              charCountColor(timezone.length, TIMEZONE_MAX_LENGTH)
            )}
          >
            {timezone.length}/{TIMEZONE_MAX_LENGTH}
          </p>
        )}
      </div>
    </>
  );
}
