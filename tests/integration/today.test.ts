import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { ITEM_STATUS } from "@/constants";
import { listToday, searchItems } from "@/lib/items/today";
import {
  HOUR,
  resetSchedulerEnvironment,
  seedBucket,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const T0 = new Date("2026-03-10T12:00:00Z");
const DAY = 24 * HOUR;

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function add(
  userId: number,
  bucketId: number,
  title: string,
  fields: Partial<typeof items.$inferInsert> = {}
) {
  const [row] = await db
    .insert(items)
    .values({ userId, bucketId, title, ...fields })
    .returning();
  return row.id;
}

const titles = (list: { title: string }[]) => list.map((i) => i.title);

describe("today", () => {
  it("lists overdue and the next day or so from every bucket, soonest first", async () => {
    const userId = await seedUser();
    const bills = await seedBucket(userId);
    const work = await seedBucket(userId);
    await add(userId, bills, "rent", { deadline: new Date(T0.getTime() - DAY) });
    await add(userId, work, "standup", { deadline: new Date(T0.getTime() + HOUR) });
    await add(userId, bills, "water", { deadline: new Date(T0.getTime() + 6 * DAY) });

    const today = await listToday(userId, T0);
    expect(titles(today.items)).toEqual(["rent", "standup"]);
    expect(today.buckets.map((b) => b.id).sort()).toEqual([bills, work].sort());
  });

  it("leaves out done, deleted, undated, far-off and hidden-bucket items, and other users'", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    const soon = new Date(T0.getTime() + HOUR);
    await add(userId, bucketId, "done", { deadline: soon, status: ITEM_STATUS.completed });
    await add(userId, bucketId, "deleted", { deadline: soon, deletedAt: T0 });
    await add(userId, bucketId, "undated");
    await add(userId, bucketId, "next month", { deadline: new Date(T0.getTime() + 30 * DAY) });
    const archived = await seedBucket(userId);
    await db.update(buckets).set({ archivedAt: T0 }).where(eq(buckets.id, archived));
    await add(userId, archived, "archived", { deadline: soon });
    const other = await seedUser();
    await add(other, await seedBucket(other), "theirs", { deadline: soon });

    expect((await listToday(userId, T0)).items).toEqual([]);
  });
});

describe("search", () => {
  it("finds open items in any bucket, ignoring case, and leaves done ones out", async () => {
    const userId = await seedUser();
    const a = await seedBucket(userId);
    const b = await seedBucket(userId);
    await add(userId, a, "Pay RENT", { status: ITEM_STATUS.completed });
    await add(userId, b, "rent the car", { deadline: new Date(T0.getTime() + DAY) });
    await add(userId, b, "groceries");

    await add(userId, a, "Rent deposit");
    expect(titles((await searchItems(userId, "rent")).items)).toEqual([
      "rent the car",
      "Rent deposit",
    ]);
  });

  it("treats % and _ as plain characters, and stays within the user's items", async () => {
    const userId = await seedUser();
    const bucketId = await seedBucket(userId);
    await add(userId, bucketId, "50% off");
    await add(userId, bucketId, "5000 steps");
    const other = await seedUser();
    await add(other, await seedBucket(other), "50% off theirs");

    expect(titles((await searchItems(userId, "50%")).items)).toEqual(["50% off"]);
    expect((await searchItems(userId, "   ")).items).toEqual([]);
  });
});
