import { useEffect, useState } from "react";
import { listMembersAction } from "@/app/(app)/actions";
import type { BucketMember } from "@/lib/buckets/members";
import { useUIStore } from "@/store/ui";
import { META_USER_ID } from "@/lib/sync/client/constants";
import { membersOf } from "@/lib/sync/client/read";
import { readMeta, readRecords } from "@/lib/sync/client/store";
import { NO_MEMBERS } from "./constants";

// Loaded again when `reloadKey` changes or a live refresh comes in, so a member who joined,
// renamed or redrew their avatar while the bucket was open shows up as they are now
export function useBucketMembers(bucketId: number | null, reloadKey: unknown) {
  const refreshTick = useUIStore((s) => s.refreshTick);
  const [loaded, setLoaded] = useState<{ bucketId: number; members: BucketMember[] } | null>(null);

  useEffect(() => {
    if (bucketId === null) return;
    let cancelled = false;
    // Without the server the people come from the device, so an item can still be added and assigned
    const local = async () => {
      const [records, me] = await Promise.all([readRecords(), readMeta<number>(META_USER_ID)]);
      return me === undefined ? [] : membersOf(records, bucketId, me);
    };
    void listMembersAction(bucketId)
      .then((result) => {
        if (!cancelled && result.ok) setLoaded({ bucketId, members: result.members });
      })
      .catch(async () => {
        const members = await local().catch(() => []);
        if (cancelled || members.length === 0) return;
        setLoaded((now) => (now?.bucketId === bucketId ? now : { bucketId, members }));
      });
    return () => {
      cancelled = true;
    };
  }, [bucketId, reloadKey, refreshTick]);

  // Another bucket's list must never show while this one loads: its people can't be assigned here
  return loaded && loaded.bucketId === bucketId ? loaded.members : NO_MEMBERS;
}
