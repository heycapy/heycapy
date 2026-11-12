import type { ReactNode } from "react";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { TextButton } from "@/components/ui/TextButton";
import { useLookParts } from "@/components/looks/LookProvider";
import type { BucketMember } from "@/lib/buckets/members";
import { memberName } from "@/lib/buckets/member-name";
import { cn } from "@/lib/utils";

// Everyone's items, the viewer's, or one other member's (by user id)
export type MemberFilter = "all" | "mine" | number;

type MembersBarProps = {
  members: BucketMember[];
  filter: MemberFilter;
  onFilter: (filter: MemberFilter) => void;
  onOpenMembers: () => void;
};

export function MembersBar({ members, filter, onFilter, onOpenMembers }: MembersBarProps) {
  const bracketed = useLookParts().textButton === "bracketed";
  const options: { value: MemberFilter; name: string; label: ReactNode }[] = [
    { value: "all", name: "all", label: "all" },
    { value: "mine", name: "mine", label: "mine" },
    ...members
      .filter((m) => !m.isYou)
      .map((m) => ({
        value: m.userId,
        name: memberName(m),
        // Phones show the face only, like the rows do
        label: (
          <>
            <PersonAvatar userId={m.userId} avatar={m.avatar} className="shrink-0" />
            <span className="ml-1 hidden truncate sm:inline">{memberName(m)}</span>
          </>
        ),
      })),
  ];

  return (
    <div className="font-ui flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-2 text-xs">
      <TextButton onClick={onOpenMembers} className="px-1">
        {members.length} people
      </TextButton>
      <div role="group" aria-label="show items for" className="flex min-w-0 flex-wrap gap-x-1">
        {options.map((option) => {
          const active = option.value === filter;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              aria-label={option.name}
              onClick={() => onFilter(option.value)}
              className={cn(
                "flex max-w-40 items-center transition-colors",
                bracketed ? "py-1" : "rounded-control min-h-(--control-h) px-3",
                !bracketed && active && "bg-muted",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {bracketed ? (
                <>
                  <span className={cn("opacity-50", !active && "opacity-0")}>[</span>
                  {option.label}
                  <span className={cn("opacity-50", !active && "opacity-0")}>]</span>
                </>
              ) : (
                option.label
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
