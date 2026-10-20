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
            "flex cursor-pointer items-center px-3 py-1.5 font-mono text-xs",
            index === highlighted ? "bg-foreground text-background" : "text-foreground"
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
