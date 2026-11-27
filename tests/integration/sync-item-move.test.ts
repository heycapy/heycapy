import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { items, syncState, syncTombstones } from "@/lib/db/schema";
import { executeToolCall } from "@/lib/ai/capyTools";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

const counter = () => db.select().from(syncState).get()?.rev ?? -1;
const itemRow = (id: string) => db.select().from(items).where(eq(items.id, id)).get();
const tombstonesAfter = (rev: number) =>
  db.select().from(syncTombstones).where(gt(syncTombstones.rev, rev)).all();

async function twoBuckets() {
  const owner = await seedUser();
  const from = await seedBucket(owner);
  const to = await seedBucket(owner);
  const id = await seedItem(owner, from, { deadline: new Date(T0.getTime() + HOUR) });
  return { owner, from, to, id };
}

describe("an item moved to another bucket", () => {
  it("is a delete from the old bucket, with a revision of its own", async () => {
    const { from, to, id } = await twoBuckets();
    const before = counter();

    db.update(items).set({ bucketId: to }).where(eq(items.id, id)).run();

    const [tombstone, ...rest] = tombstonesAfter(before);
    expect(rest).toEqual([]);
    expect(tombstone).toMatchObject({
      entity: "item",
      entityId: id,
      bucketId: from,
      userId: null,
    });
    expect(tombstone.rev).toBeGreaterThan(before);
    expect(tombstone.rev).not.toBe(itemRow(id)?.rev);
    expect(counter()).toBe(before + 2);
  });

  it("is recorded when capy moves it", async () => {
    const { owner, from, to, id } = await twoBuckets();
    const before = counter();

    const reply = await executeToolCall(
      { id: "t", name: "move_item", arguments: { item_id: id, bucket_id: to } },
      owner,
      "UTC"
    );

    expect(JSON.parse(reply)).toMatchObject({ ok: true });
    expect(tombstonesAfter(before)).toMatchObject([
      { entity: "item", entityId: id, bucketId: from },
    ]);
  });

  it("is not recorded for any other change, or for a write that leaves the bucket as it was", async () => {
    const { from, id } = await twoBuckets();
    const before = counter();

    db.update(items).set({ title: "pay the rent" }).where(eq(items.id, id)).run();
    db.update(items).set({ bucketId: from }).where(eq(items.id, id)).run();

    expect(tombstonesAfter(before)).toEqual([]);
  });
});
