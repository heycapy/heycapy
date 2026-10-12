import { EventEmitter } from "events";

declare global {
  var __dataEvents: EventEmitter | undefined;
}

// Route handlers, server actions and the scheduler each load their own copy of this module
export const dataEvents: EventEmitter = (globalThis.__dataEvents ??= new EventEmitter());

export function bucketsChanged(bucketIds: number[]): void {
  for (const bucketId of new Set(bucketIds)) dataEvents.emit("bucket", bucketId);
}
