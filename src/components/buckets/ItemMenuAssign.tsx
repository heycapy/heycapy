import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { Icon } from "@/components/ui/Icon";
import type { BucketMember } from "@/lib/buckets/members";
import { memberName } from "@/lib/buckets/member-name";
import { cn } from "@/lib/utils";
import { ASSIGN_CHIPS_MAX } from "./constants";
import { toggleAssignee } from "./assignee";
import { MenuItem } from "@/components/ui/MenuItem";

type AssignProps = {
  members: BucketMember[];
  assigneeIds: number[];
  busy: boolean;
  onAssign: (userIds: number[]) => void;
};

const nameOf = (m: BucketMember) => (m.isYou ? "you" : memberName(m));

// One tap adds or removes a person; with more people than fit, the rest are a tap further
export function AssignChips({
  members,
  assigneeIds,
  busy,
  onAssign,
  onMore,
}: AssignProps & { onMore: () => void }) {
  const shown =
    members.length > ASSIGN_CHIPS_MAX ? members.slice(0, ASSIGN_CHIPS_MAX - 1) : members;
  const chip =
    "rounded-control border-border flex max-w-32 items-center gap-1 border px-1.5 py-1 transition-colors disabled:opacity-50";
  return (
    <div
      role="group"
      aria-label="assign to"
      className="font-ui flex flex-wrap items-center gap-1.5 px-3 py-2 text-xs"
    >
      <span className="text-muted-foreground mr-1">assign</span>
      {shown.map((m) => (
        <button
          key={m.userId}
          type="button"
          aria-pressed={assigneeIds.includes(m.userId)}
          aria-label={nameOf(m)}
          disabled={busy}
          onClick={() => onAssign(toggleAssignee(members, assigneeIds, m.userId))}
          className={cn(
            chip,
            assigneeIds.includes(m.userId)
              ? "border-foreground text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <PersonAvatar userId={m.userId} avatar={m.avatar} className="shrink-0" />
          <span className="truncate">{nameOf(m)}</span>
        </button>
      ))}
      {shown.length < members.length && (
        <button
          type="button"
          onClick={onMore}
          className={cn(chip, "text-muted-foreground hover:text-foreground")}
        >
          +{members.length - shown.length} more
          <Icon name="chevron-right" />
        </button>
      )}
    </div>
  );
}

export function AssignList({ members, assigneeIds, busy, onAssign }: AssignProps) {
  return (
    <div className="py-1">
      {members.map((m) => (
        <MenuItem
          key={m.userId}
          disabled={busy}
          onClick={() => onAssign(toggleAssignee(members, assigneeIds, m.userId))}
          className="gap-2"
        >
          <PersonAvatar userId={m.userId} avatar={m.avatar} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{nameOf(m)}</span>
          {assigneeIds.includes(m.userId) && <Icon name="check" />}
        </MenuItem>
      ))}
    </div>
  );
}
