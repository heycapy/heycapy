import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  leaveBucketAction,
  listMembersAction,
  removeMemberAction,
  transferOwnershipAction,
} from "@/app/(app)/actions";
import { BUCKET_MEMBERS_MAX } from "@/lib/buckets/constants";
import { memberName } from "@/lib/buckets/member-name";
import type { ViewerBucket } from "@/lib/buckets/access";
import type { BucketMember } from "@/lib/buckets/members";
import { clockTimeIn } from "@/lib/format-date";
import { placesOf, timeGap } from "@/lib/timezones/gap";
import { ConfirmRow } from "@/components/layout/ConfirmRow";
import { InviteSection } from "./InviteSection";

type Confirming = { userId: number; action: "remove" | "owner" } | "leave" | null;

function whereTheyAre(member: BucketMember, you: BucketMember | undefined, now: Date): string {
  if (!member.place) return "timezone not set";
  if (member.isYou) return member.place;
  const gap = you && timeGap(member.timezone, you.timezone, now);
  return [member.place, `${clockTimeIn(now, member.timezone)} now`, gap]
    .filter(Boolean)
    .join(" · ");
}

export function BucketMembersPanel({
  bucket,
  onLeft,
}: {
  bucket: ViewerBucket;
  onLeft: () => void;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<BucketMember[] | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  async function load() {
    const result = await listMembersAction(bucket.id);
    if (result.ok) setMembers(result.members);
    else setError(result.error);
  }

  useEffect(() => {
    let cancelled = false;
    void listMembersAction(bucket.id).then((result) => {
      if (cancelled) return;
      if (result.ok) setMembers(result.members);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [bucket.id]);

  function remove(memberId: number) {
    setError("");
    startTransition(async () => {
      const result = await removeMemberAction(bucket.id, memberId);
      if (!result.ok) setError(result.error);
      setConfirming(null);
      await load();
    });
  }

  function makeOwner(memberId: number) {
    setError("");
    startTransition(async () => {
      const result = await transferOwnershipAction(bucket.id, memberId);
      if (!result.ok) setError(result.error);
      setConfirming(null);
      router.refresh();
      await load();
    });
  }

  function leave() {
    setError("");
    startTransition(async () => {
      const result = await leaveBucketAction(bucket.id);
      if (!result.ok) {
        setError(result.error);
        setConfirming(null);
        return;
      }
      router.refresh();
      onLeft();
    });
  }

  const now = new Date();
  const you = members?.find((m) => m.isYou);
  const showZones = members !== null && placesOf(members).differ;
  const confirmingFor = (userId: number) =>
    confirming !== null && confirming !== "leave" && confirming.userId === userId
      ? confirming.action
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground font-mono text-xs">
          people in this bucket{members ? ` (${members.length}/${BUCKET_MEMBERS_MAX})` : ""}
        </p>
        <ul className="border-border divide-border flex flex-col divide-y border">
          {members?.map((member) => (
            <li key={member.userId} className="flex flex-col gap-1.5 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{memberName(member)}</p>
                  <p className="text-muted-foreground truncate font-mono text-[11px]">
                    {member.displayName && member.username ? `@${member.username} · ` : ""}
                    {member.role}
                  </p>
                  {showZones && (
                    <p className="text-muted-foreground truncate font-mono text-[11px]">
                      {whereTheyAre(member, you, now)}
                    </p>
                  )}
                </div>
                {bucket.isOwner && member.role === "member" && !confirmingFor(member.userId) && (
                  <div className="flex shrink-0 gap-1">
                    <BracketButton
                      onClick={() => setConfirming({ userId: member.userId, action: "owner" })}
                      disabled={pending}
                    >
                      make owner
                    </BracketButton>
                    <BracketButton
                      variant="destructive"
                      onClick={() => setConfirming({ userId: member.userId, action: "remove" })}
                      disabled={pending}
                    >
                      remove
                    </BracketButton>
                  </div>
                )}
              </div>
              {confirmingFor(member.userId) === "remove" && (
                <ConfirmRow
                  text="remove them?"
                  disabled={pending}
                  onConfirm={() => remove(member.userId)}
                  onCancel={() => setConfirming(null)}
                  className="justify-end"
                />
              )}
              {confirmingFor(member.userId) === "owner" && (
                <ConfirmRow
                  text="make them the owner? you stay in as a member"
                  disabled={pending}
                  onConfirm={() => makeOwner(member.userId)}
                  onCancel={() => setConfirming(null)}
                  className="justify-end"
                />
              )}
            </li>
          ))}
        </ul>
      </div>

      {error && <span className="text-destructive font-mono text-xs">{error}</span>}

      {bucket.isOwner && members !== null && members.length > 1 && (
        <p className="text-muted-foreground font-mono text-[11px] leading-tight">
          to leave, make someone else the owner first
        </p>
      )}

      {bucket.isOwner ? (
        <InviteSection bucketId={bucket.id} />
      ) : (
        <div className="border-border flex flex-col gap-2 border-t pt-4">
          {confirming === "leave" ? (
            <ConfirmRow
              text="leave? you'll lose access"
              disabled={pending}
              onConfirm={leave}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            <BracketButton
              variant="destructive"
              onClick={() => setConfirming("leave")}
              disabled={pending}
              className="w-fit"
            >
              leave bucket
            </BracketButton>
          )}
        </div>
      )}
    </div>
  );
}
