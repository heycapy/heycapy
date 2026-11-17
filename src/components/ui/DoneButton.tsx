import { Icon } from "./Icon";
import type { IconName } from "./icons";

type DoneButtonProps = {
  label?: string;
  icon?: IconName;
  onClick: () => void;
};

export function DoneButton({ label = "done", icon = "arrow-up", onClick }: DoneButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-(--chip-radius) transition-opacity hover:opacity-85"
    >
      <Icon name={icon} />
    </button>
  );
}
