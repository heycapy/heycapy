import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { Icon } from "@/components/ui/Icon";
import type { BucketMember } from "@/lib/buckets/members";
import { memberName } from "@/lib/buckets/member-name";
import { cn } from "@/lib/utils";
import { ASSIGN_CHIPS_MAX } from "./constants";
import { MenuItem } from "@/components/ui/MenuItem";

type AssignProps = {
  members: BucketMember[];
  assigneeId: number | null;
  busy: boolean;
  onAssign: (userId: number | null) => void;
};

const nameOf = (m: BucketMember) => (m.isYou ? "you" : memberName(m));

// One tap assigns; with more people than fit, the rest are a tap further
export function AssignChips({
  members,
  assigneeId,
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
          aria-pressed={assigneeId === m.userId}
          aria-label={nameOf(m)}
          disabled={busy}
          onClick={() => onAssign(assigneeId === m.userId ? null : m.userId)}
          className={cn(
            chip,
            assigneeId === m.userId
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

export function AssignList({ members, assigneeId, busy, onAssign }: AssignProps) {
  return (
    <div className="py-1">
      {members.map((m) => (
        <MenuItem
          key={m.userId}
          disabled={busy}
          onClick={() => onAssign(m.userId)}
          className="gap-2"
        >
          <PersonAvatar userId={m.userId} avatar={m.avatar} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{nameOf(m)}</span>
          {assigneeId === m.userId && <Icon name="check" />}
        </MenuItem>
      ))}
      <MenuItem disabled={busy} onClick={() => onAssign(null)} className="gap-2">
        <span className="text-muted-foreground min-w-0 flex-1">anyone</span>
        {assigneeId === null && <Icon name="check" />}
      </MenuItem>
    </div>
  );
}
