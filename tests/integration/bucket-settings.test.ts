import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { updateBucketSettingsAction } from "@/app/(app)/bucket-actions";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0 }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => session }));

beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

const QUIET = { from: "18:00", to: "09:00" };

async function seedWorkBucket() {
  const userId = await seedUser();
  session.userId = userId;
  const bucketId = await seedBucket(userId, {
    medium: ["telegram"],
    repeat: "once",
    notifyAt: "08:00",
    quietHours: QUIET,
  });
  return { userId, bucketId };
}

function saveFromDialog(bucketId: number, notifyAt?: string) {
  return updateBucketSettingsAction(
    bucketId,
    `Work ${Math.random()}`,
    { sortBy: "deadline", drag: false, readonly: false, showCompleted: true },
    { medium: ["telegram"], notifyAt, repeat: "daily" },
    undefined,
    { notifyOnArrival: false, notifyWhenOverdue: false }
  );
}

async function storedRules(bucketId: number): Promise<Record<string, unknown>> {
  const bucket = await db.query.buckets.findFirst({ where: eq(buckets.id, bucketId) });
  return JSON.parse(bucket?.notificationsRules ?? "{}") as Record<string, unknown>;
}

describe("saving bucket settings", () => {
  it("keeps quiet hours, which the dialog does not show", async () => {
    const { bucketId } = await seedWorkBucket();
    expect(await saveFromDialog(bucketId, "08:00")).toEqual({ ok: true });

    const rules = await storedRules(bucketId);
    expect(rules.quietHours).toEqual(QUIET);
    expect(rules.repeat).toBe("daily");
  });

  it("keeps reminders out of quiet hours after a save", async () => {
    const { userId, bucketId } = await seedWorkBucket();
    // Inside the 18:00–09:00 quiet hours
    const itemId = await seedItem(userId, bucketId, { deadline: new Date("2026-03-10T20:00:00Z") });
    await saveFromDialog(bucketId, "08:00");

    const item = await db.query.items.findFirst({ where: eq(items.id, itemId) });
    expect(item?.nextReminderAt?.toISOString()).toBe("2026-03-11T09:00:00.000Z");
  });

  it("still clears a field the dialog manages", async () => {
    const { bucketId } = await seedWorkBucket();
    await saveFromDialog(bucketId, undefined);
    expect(await storedRules(bucketId)).not.toHaveProperty("notifyAt");
  });
});
