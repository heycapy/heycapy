import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BracketButton } from "@/components/ui/BracketButton";
import { leaveBucketAction, listMembersAction, removeMemberAction } from "@/app/(app)/actions";
import { BUCKET_MEMBERS_MAX } from "@/lib/buckets/constants";
import { memberName } from "@/lib/buckets/member-name";
import type { ViewerBucket } from "@/lib/buckets/access";
import type { BucketMember } from "@/lib/buckets/members";
import { InviteSection } from "./InviteSection";

type Confirming = number | "leave" | null;

function ConfirmRow({
  question,
  pending,
  onConfirm,
  onCancel,
}: {
  question: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-destructive font-mono text-xs">{question}</span>
      <BracketButton variant="destructive" onClick={onConfirm} disabled={pending}>
        confirm
      </BracketButton>
      <BracketButton onClick={onCancel} disabled={pending}>
        cancel
      </BracketButton>
    </div>
  );
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
                </div>
                {bucket.isOwner && member.role === "member" && confirming !== member.userId && (
                  <BracketButton
                    variant="destructive"
                    onClick={() => setConfirming(member.userId)}
                    disabled={pending}
                  >
                    remove
                  </BracketButton>
                )}
              </div>
              {confirming === member.userId && (
                <ConfirmRow
                  question="remove them?"
                  pending={pending}
                  onConfirm={() => remove(member.userId)}
                  onCancel={() => setConfirming(null)}
                />
              )}
            </li>
          ))}
        </ul>
      </div>

      {error && <span className="text-destructive font-mono text-xs">{error}</span>}

      {bucket.isOwner ? (
        <InviteSection bucketId={bucket.id} />
      ) : (
        <div className="border-border flex flex-col gap-2 border-t pt-4">
          {confirming === "leave" ? (
            <ConfirmRow
              question="leave? you'll lose access"
              pending={pending}
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
