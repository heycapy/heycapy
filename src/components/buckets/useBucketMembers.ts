import { useEffect, useState } from "react";
import { listMembersAction } from "@/app/(app)/actions";
import type { BucketMember } from "@/lib/buckets/members";
import { useUIStore } from "@/store/ui";

// Loaded again when `reloadKey` changes or a live refresh comes in, so a member who joined,
// renamed or redrew their avatar while the bucket was open shows up as they are now
export function useBucketMembers(bucketId: number, reloadKey: unknown) {
  const refreshTick = useUIStore((s) => s.refreshTick);
  const [members, setMembers] = useState<BucketMember[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listMembersAction(bucketId).then((result) => {
      if (!cancelled && result.ok) setMembers(result.members);
    });
    return () => {
      cancelled = true;
    };
  }, [bucketId, reloadKey, refreshTick]);

  return members;
}
