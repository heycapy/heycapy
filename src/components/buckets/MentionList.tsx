import { cn } from "@/lib/utils";
import type { MentionOption } from "@/lib/items/mention";

type MentionListProps = {
  options: MentionOption[];
  highlighted: number;
  onPick: (option: MentionOption) => void;
  onHover: (index: number) => void;
};

export function MentionList({ options, highlighted, onPick, onHover }: MentionListProps) {
  return (
    <ul
      role="listbox"
      aria-label="assign to"
      className="border-border divide-border divide-y border"
    >
      {options.map((option, index) => (
        <li
          key={option.userId ?? "anyone"}
          role="option"
          aria-selected={index === highlighted}
          // Keeps the cursor in the title instead of moving focus to the list
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(option);
          }}
          onMouseEnter={() => onHover(index)}
          className={cn(
            "flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 font-mono text-xs",
            index === highlighted ? "bg-foreground text-background" : "text-foreground"
          )}
        >
          <span className="truncate">{option.label}</span>
          {option.username && (
            <span
              className={cn(
                "truncate text-[11px]",
                index === highlighted ? "text-background/70" : "text-muted-foreground"
              )}
            >
              @{option.username}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
