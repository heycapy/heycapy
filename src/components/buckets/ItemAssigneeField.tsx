import { OptionButton } from "@/components/ui/OptionButton";
import { memberName } from "@/lib/buckets/member-name";
import type { BucketMember } from "@/lib/buckets/members";

export type AssigneeChoice = {
  members: BucketMember[];
  value: number | null;
  onChange: (assigneeId: number | null) => void;
};

export function ItemAssigneeField({
  choice,
  disabled,
}: {
  choice: AssigneeChoice;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 pb-5">
      <label className="text-muted-foreground font-mono text-xs">assigned to</label>
      <div className="flex flex-wrap gap-1.5">
        <OptionButton
          active={choice.value === null}
          onClick={() => choice.onChange(null)}
          disabled={disabled}
        >
          anyone
        </OptionButton>
        {choice.members.map((member) => (
          <OptionButton
            key={member.userId}
            active={choice.value === member.userId}
            onClick={() => choice.onChange(member.userId)}
            disabled={disabled}
          >
            {memberName(member)}
            {member.isYou ? " (you)" : ""}
          </OptionButton>
        ))}
      </div>
    </div>
  );
}
