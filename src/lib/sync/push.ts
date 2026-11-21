import { and, eq } from "drizzle-orm";
import type { ActionResult } from "@/types/result";
import type { DbHandle } from "@/lib/db/handle";
import { items, syncDevices } from "@/lib/db/schema";
import { addItem } from "@/lib/items/add";
import { deleteItem } from "@/lib/items/delete";
import { updateItem } from "@/lib/items/update";
import { ITEM_GONE_ERROR } from "@/constants";
import { Mutation, type PushResult, type RawMutation } from "./protocol";

const INVALID_CHANGE = "This change isn't valid";
const UNKNOWN_CHANGE = "This change isn't supported";
const ITEM_EXISTS = "That item already exists";

function run(h: DbHandle, userId: number, mutation: Mutation, now: Date): ActionResult {
  switch (mutation.type) {
    case "item.create": {
      if (h.select({ id: items.id }).from(items).where(eq(items.id, mutation.id)).get()) {
        return { ok: false, error: ITEM_EXISTS };
      }
      return addItem(h, userId, mutation, now);
    }
    case "item.patch":
      return updateItem(h, userId, mutation.id, mutation.patch, now);
    case "item.delete":
      return deleteItem(h, userId, mutation.id, now)
        ? { ok: true }
        : { ok: false, error: ITEM_GONE_ERROR };
  }
}

// One mutation and the device's sequence number are one transaction: a crash leaves neither, so
// the device sends it again. A change that is refused for good also moves the sequence on, so it
// isn't sent again. A failure that may pass (anything thrown) is not a result, it fails the call
function applyOne(
  h: DbHandle,
  userId: number,
  deviceId: string,
  raw: RawMutation,
  now: Date
): PushResult {
  return h.transaction((tx) => {
    const device = tx
      .select({ lastSeq: syncDevices.lastSeq })
      .from(syncDevices)
      .where(and(eq(syncDevices.userId, userId), eq(syncDevices.deviceId, deviceId)))
      .get();
    if (raw.seq <= (device?.lastSeq ?? 0)) return { seq: raw.seq, result: "duplicate" };

    const parsed = Mutation.safeParse(raw);
    const outcome = parsed.success
      ? run(tx, userId, parsed.data, now)
      : { ok: false as const, error: knownType(raw.type) ? INVALID_CHANGE : UNKNOWN_CHANGE };

    tx.insert(syncDevices)
      .values({ userId, deviceId, lastSeq: raw.seq })
      .onConflictDoUpdate({
        target: [syncDevices.userId, syncDevices.deviceId],
        set: { lastSeq: raw.seq },
      })
      .run();
    return outcome.ok
      ? { seq: raw.seq, result: "applied" }
      : { seq: raw.seq, result: "rejected", reason: outcome.error };
  });
}

function knownType(type: string): boolean {
  return Mutation.options.some((option) => option.shape.type.value === type);
}

export function applyPush(
  h: DbHandle,
  userId: number,
  deviceId: string,
  mutations: RawMutation[],
  now = new Date()
): PushResult[] {
  return mutations.map((mutation) => applyOne(h, userId, deviceId, mutation, now));
}
