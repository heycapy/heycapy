import { OptionButton } from "@/components/ui/OptionButton";
import { memberName } from "@/lib/buckets/member-name";
import type { BucketMember } from "@/lib/buckets/members";
import { placesOf } from "@/lib/timezones/gap";
import { PersonAvatar } from "@/components/avatar/PersonAvatar";

export type AssigneeChoice = {
  bucketId: number;
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
  const showPlaces = placesOf(choice.members).differ;
  // When nobody gets reminders the bucket itself says so; here it only marks who is left out
  const someoneReminded = choice.members.some((m) => m.remindable);
  const leftOut = (member: BucketMember) => someoneReminded && !member.remindable;
  return (
    <div className="flex flex-col gap-1.5 pb-5">
      <label className="text-muted-foreground font-mono text-xs">assigned to</label>
      <div className="flex flex-wrap items-start gap-1.5">
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
            className="text-left"
          >
            <span className="flex items-center gap-1.5">
              <PersonAvatar userId={member.userId} avatar={member.avatar} />
              {memberName(member)}
              {member.isYou ? " (you)" : ""}
            </span>
            {(showPlaces || leftOut(member)) && (
              <span className="block text-[11px] opacity-70">
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
    </div>
  );
}
