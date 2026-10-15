import { useEffect, useState } from "react";
import { listMembersAction } from "@/app/(app)/actions";
import type { BucketMember } from "@/lib/buckets/members";

// Loaded again when `reloadKey` changes, so someone who joined while the bucket was open shows up
export function useBucketMembers(bucketId: number, reloadKey: unknown) {
  const [members, setMembers] = useState<BucketMember[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listMembersAction(bucketId).then((result) => {
      if (!cancelled && result.ok) setMembers(result.members);
    });
    return () => {
      cancelled = true;
    };
  }, [bucketId, reloadKey]);

  return members;
}
