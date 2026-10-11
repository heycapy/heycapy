import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, users, userSettings } from "@/lib/db/schema";
import { deadlineHintsAction } from "@/app/(app)/member-actions";
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
// 9:00 in India, 3:30am in London (after the UK clock change)
const NINE_INDIA = "2026-10-26T03:30:00.000Z";
// 1pm in India, 7:30am in London
const ONE_PM_INDIA = "2026-10-26T07:30:00.000Z";

beforeEach(() => useSchedulerEnvironment(new Date("2026-10-20T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

async function sharedBucket() {
  const owner = await seedUser(INDIA);
  const sam = await seedUser(LONDON);
  await db.update(users).set({ displayName: "Sam" }).where(eq(users.id, sam));
  await db
    .update(userSettings)
    .set({ quietHoursFrom: "23:00", quietHoursTo: "08:00" })
    .where(eq(userSettings.userId, sam));
  const bucketId = await seedBucket(owner, { medium: ["telegram"], repeat: "once" });
  await db.insert(bucketMembers).values({ bucketId, userId: sam });
  session.userId = owner;
  return { owner, sam, bucketId };
}

const draft = (deadline: string, assigneeId: number | null = null) => ({
  deadline,
  clock: null,
  assigneeId,
  reminderOffsets: [0],
});

describe("hints for a deadline being edited", () => {
  it("warns about a time at night and in quiet hours for someone else", async () => {
    const { bucketId } = await sharedBucket();
    expect(await deadlineHintsAction(bucketId, draft(NINE_INDIA))).toEqual({
      ok: true,
      hints: [{ name: "Sam", isYou: false, night: true, quiet: true, heldPastDeadline: true }],
    });
  });

  it("says when quiet hours hold the reminder until after it's due", async () => {
    const { bucketId } = await sharedBucket();
    expect(await deadlineHintsAction(bucketId, draft(ONE_PM_INDIA))).toEqual({
      ok: true,
      hints: [{ name: "Sam", isYou: false, night: false, quiet: true, heldPastDeadline: true }],
    });
  });

  it("doesn't blame quiet hours when remind-at already puts the reminder after it's due", async () => {
    const { bucketId } = await sharedBucket();
    await db
      .update(buckets)
      .set({
        notificationsRules: JSON.stringify({
          medium: ["telegram"],
          repeat: "once",
          notifyAt: "10:00",
        }),
      })
      .where(eq(buckets.id, bucketId));
    expect(await deadlineHintsAction(bucketId, draft(ONE_PM_INDIA))).toEqual({
      ok: true,
      hints: [{ name: "Sam", isYou: false, night: false, quiet: true, heldPastDeadline: false }],
    });
  });

  it("only looks at the person it's assigned to", async () => {
    const { owner, sam, bucketId } = await sharedBucket();
    expect(await deadlineHintsAction(bucketId, draft(NINE_INDIA, owner))).toEqual({
      ok: true,
      hints: [],
    });
    expect((await deadlineHintsAction(bucketId, draft(NINE_INDIA, sam))).ok).toBe(true);
    // 11:30pm in India is night, but you picked it
    expect(await deadlineHintsAction(bucketId, draft("2026-10-26T18:00:00.000Z", owner))).toEqual({
      ok: true,
      hints: [],
    });
  });

  it("names your own quiet hours, never your own night", async () => {
    const { owner, bucketId } = await sharedBucket();
    await db
      .update(userSettings)
      .set({ quietHoursFrom: "08:00", quietHoursTo: "10:00" })
      .where(eq(userSettings.userId, owner));
    const { hints } = (await deadlineHintsAction(bucketId, draft(NINE_INDIA, owner))) as {
      hints: unknown[];
    };
    expect(hints).toEqual([
      { name: "you", isYou: true, night: false, quiet: true, heldPastDeadline: true },
    ]);
  });

  it("says nothing for an all-day date at someone's night, and refuses outsiders", async () => {
    const { bucketId } = await sharedBucket();
    expect(await deadlineHintsAction(bucketId, draft("2026-10-26"))).toEqual({
      ok: true,
      hints: [],
    });
    expect(
      await deadlineHintsAction(bucketId, { ...draft(NINE_INDIA), clock: "Mars/Olympus" })
    ).toEqual({ ok: false, error: "That timezone doesn't exist" });
    session.userId = await seedUser(LONDON);
    expect(await deadlineHintsAction(bucketId, draft(NINE_INDIA))).toEqual({
      ok: false,
      error: "Bucket not found",
    });
  });
});
