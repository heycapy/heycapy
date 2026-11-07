import { cn } from "@/lib/utils";
import type { MentionOption } from "@/lib/items/mention";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";

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
      className="border-border divide-border rounded-control divide-y-(length:--menu-row-divider) border p-(--menu-inset)"
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
          onPointerMove={() => onHover(index)}
          className={cn(
            "rounded-control font-ui flex cursor-pointer items-center px-3 py-1.5 text-xs",
            index === highlighted ? "bg-(--selected-bg) text-(--selected-fg)" : "text-foreground"
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {option.userId !== null && (
              <PersonAvatar userId={option.userId} avatar={option.avatar} />
            )}
            <span className="truncate">{option.label}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
