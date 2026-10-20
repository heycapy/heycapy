import { EventEmitter } from "events";
import { memberBucketIds } from "@/lib/buckets/access";

declare global {
  var __dataEvents: EventEmitter | undefined;
}

// Route handlers, server actions and the scheduler each load their own copy of this module
export const dataEvents: EventEmitter = (globalThis.__dataEvents ??= new EventEmitter());

export function bucketsChanged(bucketIds: number[]): void {
  for (const bucketId of new Set(bucketIds)) dataEvents.emit("bucket", bucketId);
}

// Someone's name and avatar show in every bucket they share
export async function personChanged(userId: number): Promise<void> {
  const rows = await memberBucketIds(userId);
  bucketsChanged(rows.map((row) => row.id));
}
