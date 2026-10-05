import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  archiveBucketAction,
  deleteBucketAction,
  restoreBucketAction,
  restoreDeletedBucketAction,
} from "@/app/(app)/bucket-actions";
import { executeToolCall, getUpcomingItems } from "@/lib/ai/capyTools";
import {
  MINUTE,
  remindersQueued,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

const T0 = new Date("2026-03-10T12:00:00Z");
const DUE = new Date(T0.getTime() + 30 * MINUTE);
const AFTER_DUE = new Date(DUE.getTime() + MINUTE);

beforeEach(() => useSchedulerEnvironment(T0));
afterEach(() => resetSchedulerEnvironment());

async function seedDueItem() {
  const userId = await seedUser();
  session.userId = userId;
  const bucketId = await seedBucket(userId);
  const itemId = await seedItem(userId, bucketId, { deadline: DUE, title: "read for 15 mins" });
  return { userId, bucketId, itemId };
}

async function capy(userId: number, name: string, args: Record<string, unknown>, turnId?: number) {
  return JSON.parse(
    await executeToolCall({ id: "t", name, arguments: args }, userId, "UTC", turnId)
  ) as unknown;
}

async function capyDeletesBucket(userId: number, bucketId: number) {
  await capy(userId, "delete_bucket", { bucket_id: bucketId }, 1);
  await capy(userId, "delete_bucket", { bucket_id: bucketId }, 2);
}

describe("a deleted bucket's items", () => {
  it("send no reminders, whether capy or the app deleted the bucket", async () => {
    const byCapy = await seedDueItem();
    await capyDeletesBucket(byCapy.userId, byCapy.bucketId);
    const byApp = await seedDueItem();
    await deleteBucketAction(byApp.bucketId);

    await runSchedulerAt(AFTER_DUE);
    expect(await remindersQueued(byCapy.itemId)).toBe(0);
    expect(await remindersQueued(byApp.itemId)).toBe(0);
  });

  it("remind again once the bucket is restored from trash", async () => {
    const { bucketId, itemId } = await seedDueItem();
    await deleteBucketAction(bucketId);
    await restoreDeletedBucketAction(bucketId);

    await runSchedulerAt(AFTER_DUE);
    expect(await remindersQueued(itemId)).toBe(1);
  });

  it("are left out of capy's searches, upcoming list and bucket lists", async () => {
    const { userId, bucketId } = await seedDueItem();
    await capyDeletesBucket(userId, bucketId);

    expect(await capy(userId, "search_items", { deadline_filter: "today" })).toEqual([]);
    expect(await getUpcomingItems(userId, "UTC")).toEqual([]);
    expect(await capy(userId, "list_items", { bucket_id: bucketId })).toEqual({
      ok: false,
      error: "Bucket not found",
    });
  });
});

describe("an archived bucket's items", () => {
  it("send no reminders until the bucket is unarchived", async () => {
    const archived = await seedDueItem();
    await archiveBucketAction(archived.bucketId);
    const unarchived = await seedDueItem();
    await archiveBucketAction(unarchived.bucketId);
    await restoreBucketAction(unarchived.bucketId);

    await runSchedulerAt(AFTER_DUE);
    expect(await remindersQueued(archived.itemId)).toBe(0);
    expect(await remindersQueued(unarchived.itemId)).toBe(1);
  });

  it("are left out of capy's searches", async () => {
    const { userId, bucketId } = await seedDueItem();
    await archiveBucketAction(bucketId);

    expect(await capy(userId, "search_items", { keyword: "read" })).toEqual([]);
    expect(await getUpcomingItems(userId, "UTC")).toEqual([]);
  });
});

it("capy still finds items in live buckets, with the bucket's name", async () => {
  const { userId } = await seedDueItem();
  const found = (await capy(userId, "search_items", { deadline_filter: "today" })) as {
    title: string;
    bucket: string;
  }[];
  expect(found.map((i) => i.title)).toEqual(["read for 15 mins"]);
  expect(found[0].bucket).not.toBe("Unknown");
});
