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
      style={{ color }}
      className="group/tick -ml-1.5 flex shrink-0 items-center justify-center pr-2.5 pl-1.5 disabled:cursor-default"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
        <path
          d="M2 0h12v2H2zM2 14h12v2H2zM0 2h2v12H0zM14 2h2v12h-2z"
          fill="currentColor"
          className={cn(
            "transition-opacity",
            !checked && "opacity-70",
            !checked && onToggle && "group-hover/tick:opacity-100"
          )}
        />
        {checked && <path d="M5 4h6v1H5zM4 5h8v6H4zM5 11h6v1H5z" fill="currentColor" />}
      </svg>
    </button>
  );
}
