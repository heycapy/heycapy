import { useEffect, useState } from "react";
import { listMembersAction } from "@/app/(app)/actions";
import type { BucketMember } from "@/lib/buckets/members";
import { useUIStore } from "@/store/ui";
import { NO_MEMBERS } from "./constants";

// Loaded again when `reloadKey` changes or a live refresh comes in, so a member who joined,
// renamed or redrew their avatar while the bucket was open shows up as they are now
export function useBucketMembers(bucketId: number | null, reloadKey: unknown) {
  const refreshTick = useUIStore((s) => s.refreshTick);
  const [loaded, setLoaded] = useState<{ bucketId: number; members: BucketMember[] } | null>(null);

  useEffect(() => {
    if (bucketId === null) return;
    let cancelled = false;
    void listMembersAction(bucketId).then((result) => {
      if (!cancelled && result.ok) setLoaded({ bucketId, members: result.members });
    });
    return () => {
      cancelled = true;
    };
  }, [bucketId, reloadKey, refreshTick]);

  // Another bucket's list must never show while this one loads: its people can't be assigned here
  return loaded && loaded.bucketId === bucketId ? loaded.members : NO_MEMBERS;
}
