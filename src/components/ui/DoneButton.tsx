import { Icon } from "./Icon";
import type { IconName } from "./icons";

type DoneButtonProps = {
  label?: string;
  icon?: IconName;
  disabled?: boolean;
  onClick: () => void;
};

export function DoneButton({
  label = "done",
  icon = "arrow-up",
  disabled,
  onClick,
}: DoneButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-(--chip-radius) transition-opacity hover:opacity-85 disabled:opacity-40"
    >
      <Icon name={icon} />
    </button>
  );
}
