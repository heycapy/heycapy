import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { listOpenItems } from "@/lib/items/open-items";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function add(
  userId: number,
  bucketId: number,
  fields: Partial<typeof items.$inferInsert> = {}
) {
  await db.insert(items).values({ userId, bucketId, title: "x", ...fields });
}

describe("open items for the bucket counts", () => {
  it("lists open items in live buckets, dated or not, and nothing closed, deleted or someone else's", async () => {
    const userId = await seedUser();
    const bills = await seedBucket(userId);
    await add(userId, bills, { deadline: T0, deadlineTimezone: "Asia/Kolkata" });
    await add(userId, bills);
    await add(userId, bills, { status: ITEM_STATUS.completed });
    await add(userId, bills, { status: ITEM_STATUS.missed });
    await add(userId, bills, { deletedAt: T0 });
    const archived = await seedBucket(userId);
    await db.update(buckets).set({ archivedAt: T0 }).where(eq(buckets.id, archived));
    await add(userId, archived);
    const other = await seedUser();
    await add(other, await seedBucket(other));

    const open = await listOpenItems(userId);
    expect(open).toHaveLength(2);
    expect(open).toContainEqual({
      bucketId: bills,
      deadline: T0,
      deadlineTimezone: "Asia/Kolkata",
    });
    expect(open).toContainEqual({ bucketId: bills, deadline: null, deadlineTimezone: null });
  });
});
