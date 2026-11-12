import { OptionButton } from "@/components/ui/OptionButton";
import { memberName } from "@/lib/buckets/member-name";
import type { BucketMember } from "@/lib/buckets/members";
import { placesOf } from "@/lib/timezones/gap";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";
import { LABEL } from "@/components/layout/settings-constants";
import { resolveAssignees, toggleAssignee } from "./assignee";

export type AssigneeChoice = {
  bucketId: number;
  members: BucketMember[];
  // null is a new item nobody has picked for yet, which means everyone
  value: number[] | null;
  onChange: (assigneeIds: number[]) => void;
};

export function ItemAssigneeField({
  choice,
  disabled,
}: {
  choice: AssigneeChoice;
  disabled?: boolean;
}) {
  const showPlaces = placesOf(choice.members).differ;
  // When nobody gets reminders the bucket itself says so, here it only marks who is left out
  const someoneReminded = choice.members.some((m) => m.remindable);
  const leftOut = (member: BucketMember) => someoneReminded && !member.remindable;
  const selected = resolveAssignees(choice.members, choice.value);
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL}>assigned to</label>
      <div className="flex flex-wrap items-start gap-1.5">
        {choice.members.map((member) => (
          <OptionButton
            key={member.userId}
            active={selected.includes(member.userId)}
            onClick={() => choice.onChange(toggleAssignee(choice.members, selected, member.userId))}
            disabled={disabled}
            className="text-left"
          >
            <span className="flex items-center gap-1.5">
              <PersonAvatar userId={member.userId} avatar={member.avatar} />
              {memberName(member)}
              {member.isYou ? " (you)" : ""}
            </span>
            {(showPlaces || leftOut(member)) && (
              <span className="text-2xs block opacity-70">
                {[
                  showPlaces && (member.place ?? "timezone not set"),
                  leftOut(member) && "no reminders set up",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </OptionButton>
        ))}
      </div>
      {selected.length === 0 && (
        <p className="text-2xs text-muted-foreground">no one is reminded about this one</p>
      )}
    </div>
  );
}
