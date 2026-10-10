import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, items, userSettings } from "@/lib/db/schema";
import {
  addItemAction,
  completeItemAction,
  moveItemAction,
  updateItemAction,
} from "@/app/(app)/item-actions";
import { refreshUserReminders } from "@/lib/reminders/refresh";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const INDIA = "Asia/Kolkata";
const LONDON = "Europe/London";
const NOW = new Date("2026-10-10T12:00:00Z");
const OCT_12_INDIA = new Date("2026-10-11T18:30:00Z");
const OCT_12_LONDON = new Date("2026-10-11T23:00:00Z");
const WEEKLY = { enabled: true, frequency: "weekly", interval: 1, endDate: null } as const;
const DAILY = { enabled: true, frequency: "daily", interval: 1, endDate: null } as const;

beforeEach(() => useSchedulerEnvironment(NOW));
afterEach(() => resetSchedulerEnvironment());

async function sharedBucket() {
  const owner = await seedUser(INDIA);
  const member = await seedUser(LONDON);
  const bucketId = await seedBucket(owner, {
    medium: ["telegram"],
    repeat: "once",
    notifyAt: "09:00",
  });
  await db.insert(bucketMembers).values({ bucketId, userId: member });
  return { owner, member, bucketId };
}

async function latest(bucketId: number) {
  const [row] = await db
    .select()
    .from(items)
    .where(eq(items.bucketId, bucketId))
    .orderBy(desc(items.id))
    .limit(1);
  if (!row) throw new Error("no item");
  return row;
}

describe("a date without a time in a bucket shared between India and London", () => {
  it("is saved on the clock of whoever set it", async () => {
    const { owner, member, bucketId } = await sharedBucket();

    session.userId = owner;
    await addItemAction(bucketId, "pay rent", "2026-10-12");
    expect(await latest(bucketId)).toMatchObject({
      deadline: OCT_12_INDIA,
      deadlineTimezone: INDIA,
    });

    session.userId = member;
    await addItemAction(bucketId, "renew passport", "2026-10-12");
    expect(await latest(bucketId)).toMatchObject({
      deadline: OCT_12_LONDON,
      deadlineTimezone: LONDON,
    });
  });

  it("doesn't move or re-remind when someone on another clock saves it again", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    await addItemAction(bucketId, "pay rent", "2026-10-12");
    const { id } = await latest(bucketId);
    await db.update(items).set({ notifiedAt: NOW }).where(eq(items.id, id));

    session.userId = member;
    await updateItemAction(id, "pay the rent", "2026-10-12");

    expect(await latest(bucketId)).toMatchObject({
      title: "pay the rent",
      deadline: OCT_12_INDIA,
      deadlineTimezone: INDIA,
      notifiedAt: NOW,
    });
  });

  it("stays all day when its creator's timezone changes", async () => {
    const { owner, bucketId } = await sharedBucket();
    session.userId = owner;
    await addItemAction(bucketId, "pay rent", "2026-10-12");

    await db.update(userSettings).set({ timezone: LONDON }).where(eq(userSettings.userId, owner));
    await refreshUserReminders(owner);

    // 09:00 on 12 Oct on the creator's new clock, not the stored midnight read as a time
    expect((await latest(bucketId)).nextReminderAt).toEqual(new Date("2026-10-12T08:00:00Z"));
  });
});

describe("a repeating item keeps its series on the clock it was set on", () => {
  it("when someone on another clock moves one occurrence to another date", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    await addItemAction(bucketId, "pay rent", "2026-10-12", undefined, WEEKLY);
    const { id } = await latest(bucketId);

    session.userId = member;
    expect(await moveItemAction(id, "2026-10-13")).toEqual({ ok: true });

    expect(await latest(bucketId)).toMatchObject({
      deadline: new Date("2026-10-12T18:30:00Z"),
      deadlineTimezone: INDIA,
    });
  });

  it("across the UK clock change, after its creator's timezone changed", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    session.userId = owner;
    await addItemAction(bucketId, "call home", "2026-10-24T03:30:00.000Z", undefined, DAILY);
    const { id } = await latest(bucketId);
    await db.update(userSettings).set({ timezone: LONDON }).where(eq(userSettings.userId, owner));

    session.userId = member;
    await completeItemAction(id);

    // Still 09:00 in India; on London's clock it moved from 04:30 to 03:30
    expect(await latest(bucketId)).toMatchObject({
      deadline: new Date("2026-10-25T03:30:00Z"),
      deadlineTimezone: INDIA,
    });
  });
});
