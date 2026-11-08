import { OptionButton } from "@/components/ui/OptionButton";
import type { ClockOption } from "./useItemClock";

export function ItemClockField({
  options,
  place,
  onPick,
  disabled,
}: {
  options: ClockOption[];
  place: string | null;
  onPick: (timezone: string) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label="time on" className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground font-ui text-2xs">time on</span>
      {options.map((option) => (
        <OptionButton
          key={option.place}
          active={option.place === place}
          onClick={() => onPick(option.timezone)}
          disabled={disabled}
          className="text-2xs px-2 py-1"
        >
          {option.place}
        </OptionButton>
      ))}
    </div>
  );
}
