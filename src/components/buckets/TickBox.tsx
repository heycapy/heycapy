import { cn } from "@/lib/utils";

type TickBoxProps = {
  title: string;
  checked: boolean;
  color: string;
  onToggle?: () => void;
};

export function TickBox({ title, checked, color, onToggle }: TickBoxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={title}
      disabled={!onToggle}
      onClick={onToggle}
      style={checked ? { color } : undefined}
      className={cn(
        "group/tick -ml-1.5 flex shrink-0 items-center justify-center pr-2.5 pl-1.5 disabled:cursor-default",
        !checked && "text-muted-foreground"
      )}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" shapeRendering="crispEdges" aria-hidden>
        <path
          d="M1 0h12v1H1zM1 13h12v1H1zM0 1h1v12H0zM13 1h1v12h-1z"
          fill="currentColor"
          className={cn(
            "transition-opacity",
            !checked && "opacity-40",
            !checked && onToggle && "group-hover/tick:opacity-100"
          )}
        />
        {checked && <path d="M4 4h6v6H4z" fill="currentColor" />}
      </svg>
    </button>
  );
}
