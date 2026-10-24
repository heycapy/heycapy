import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  buckets,
  creditLedger,
  guideTasks,
  items,
  usernameChanges,
  userSettings,
  users,
} from "@/lib/db/schema";
import { createOtp } from "@/lib/auth/otp";
import { verifyOtpAction } from "@/app/(auth)/login/actions";
import { pickedThemeAction } from "@/app/(app)/guide-actions";
import { seed } from "@/lib/db/seed";
import { markGuideTaskDone, syncGuide } from "@/lib/guide/guide";
import { GUIDE_TASKS } from "@/lib/guide/constants";
import { creditBalance, rewardGuideTask } from "@/lib/credits";
import { CREDITS_FREE_GRANT } from "@/constants";
import { seedBucket, seedUser } from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  createSession: async () => {},
  getSession: async () => (session.userId ? session : null),
}));

let signupCount = 0;

async function signUp(): Promise<{ userId: number; starterBucketId: number }> {
  signupCount += 1;
  const email = `guide-${signupCount}-${Date.now()}@heycapy.test`;
  const result = await verifyOtpAction(email, await createOtp(email));
  if (!result.ok || result.starterBucketId === undefined) throw new Error("sign-up failed");
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user) throw new Error("no user");
  return { userId: user.id, starterBucketId: result.starterBucketId };
}

async function doneTasks(userId: number): Promise<string[]> {
  return (await syncGuide(userId)).tasks.filter((t) => t.done).map((t) => t.key);
}

function rewards(userId: number) {
  return db
    .select({ amount: creditLedger.amount, note: creditLedger.note })
    .from(creditLedger)
    .where(and(eq(creditLedger.userId, userId), eq(creditLedger.kind, "reward")))
    .all();
}

const taskCredits = (key: string) => GUIDE_TASKS.find((t) => t.key === key)?.credits;

beforeAll(async () => {
  await seed(0);
});

beforeEach(() => {
  vi.stubEnv("HOSTED", "true");
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "bot-token");
});

describe("getting started", () => {
  it("a new account gets a reminders bucket, 15 free credits and nothing done yet", async () => {
    const { userId, starterBucketId } = await signUp();

    const owned = await db.query.buckets.findMany({ where: eq(buckets.userId, userId) });
    expect(owned.map((b) => ({ id: b.id, name: b.name }))).toEqual([
      { id: starterBucketId, name: "reminders" },
    ]);
    const guide = await syncGuide(userId);
    expect(guide.tasks.map((t) => t.key)).toEqual(GUIDE_TASKS.map((t) => t.key));
    expect(guide.tasks.some((t) => t.done)).toBe(false);
    expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
    expect(guide.paysCredits).toBe(true);
  });

  it("every task pays 3 to 5 credits, 50 in all", () => {
    for (const task of GUIDE_TASKS) {
      expect(task.credits).toBeGreaterThanOrEqual(3);
      expect(task.credits).toBeLessThanOrEqual(5);
    }
    expect(GUIDE_TASKS.reduce((sum, task) => sum + task.credits, 0)).toBe(50);
  });

  it("picking a theme ticks its task, the server can't see the theme itself", async () => {
    const { userId } = await signUp();
    session.userId = userId;
    expect(await doneTasks(userId)).not.toContain("theme");

    await pickedThemeAction();
    const guide = await syncGuide(userId);
    expect(guide.tasks.find((t) => t.key === "theme")).toMatchObject({
      done: true,
      earned: taskCredits("theme"),
    });
  });

  it("a task done anywhere ticks and pays once, and stays done after it's undone", async () => {
    const { userId, starterBucketId } = await signUp();

    const [item] = await db
      .insert(items)
      .values({ bucketId: starterBucketId, userId, title: "pay rent", source: "ai" })
      .returning({ id: items.id });
    const first = await syncGuide(userId);
    expect(first.tasks.find((t) => t.key === "add_item")).toMatchObject({
      done: true,
      earned: taskCredits("add_item"),
    });
    await syncGuide(userId);

    await db.delete(items).where(eq(items.id, item.id));
    expect(await doneTasks(userId)).toEqual(["add_item"]);
    expect(rewards(userId)).toEqual([
      { amount: taskCredits("add_item"), note: "getting started: add_item" },
    ]);
    expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT + (taskCredits("add_item") ?? 0));
  });

  it("the reminders bucket made at sign-up isn't a bucket of your own, a later one is", async () => {
    const { userId } = await signUp();
    expect(await doneTasks(userId)).not.toContain("own_bucket");

    await new Promise((resolve) => setTimeout(resolve, 1100));
    await seedBucket(userId);
    expect(await doneTasks(userId)).toContain("own_bucket");
  });

  it("a username an admin changed doesn't count as changing it yourself", async () => {
    const { userId } = await signUp();
    await db.insert(usernameChanges).values({ userId, newUsername: "by-admin", byAdmin: true });
    expect(await doneTasks(userId)).not.toContain("username");

    await db.insert(usernameChanges).values({ userId, newUsername: "by-me" });
    expect(await doneTasks(userId)).toContain("username");
  });

  it("a saved smtp server isn't enough, only a test email that went out", async () => {
    const { userId } = await signUp();
    await db
      .update(userSettings)
      .set({ emailProvider: "smtp", smtpHost: "smtp.heycapy.test" })
      .where(eq(userSettings.userId, userId));
    expect(await doneTasks(userId)).not.toContain("smtp");

    expect(await markGuideTaskDone(userId, "smtp")).toBe(taskCredits("smtp"));
    expect(await markGuideTaskDone(userId, "smtp")).toBe(0);
    expect(await doneTasks(userId)).toContain("smtp");
  });

  it("an older account that got 50 at sign-up still earns every task's credits", async () => {
    const userId = await seedUser();
    await db
      .insert(creditLedger)
      .values({ userId, amount: 50, kind: "grant", note: "free credits" });

    let paid = 0;
    for (const task of GUIDE_TASKS) paid += await markGuideTaskDone(userId, task.key);

    expect(paid).toBe(50);
    expect(creditBalance(userId)).toBe(100);
  });

  it("a reward is paid once even if asked twice", async () => {
    const userId = await seedUser();
    const pay = () => db.transaction((tx) => rewardGuideTask(tx, userId, "avatar", 5));
    expect(pay()).toBe(5);
    expect(pay()).toBe(0);
    expect(rewards(userId)).toHaveLength(1);
  });

  it("a task whose credits fail to pay isn't saved as done, so the next check pays it", async () => {
    const userId = await seedUser();
    db.run(sql`create trigger fail_reward before insert on credit_ledger when new.kind = 'reward'
      begin select raise(abort, 'ledger down'); end`);
    try {
      await expect(markGuideTaskDone(userId, "smtp")).rejects.toThrow("ledger down");
    } finally {
      db.run(sql`drop trigger fail_reward`);
    }
    expect(await doneTasks(userId)).not.toContain("smtp");

    expect(await markGuideTaskDone(userId, "smtp")).toBe(taskCredits("smtp"));
  });

  it("a self-hosted server ticks tasks but keeps no ledger", async () => {
    vi.stubEnv("HOSTED", "");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const userId = await seedUser();
    await db
      .update(users)
      .set({ avatar: ".".repeat(256) })
      .where(eq(users.id, userId));

    const guide = await syncGuide(userId);
    expect(guide.paysCredits).toBe(false);
    expect(guide.tasks.map((t) => t.key)).not.toContain("telegram");
    expect(guide.tasks.find((t) => t.key === "avatar")).toMatchObject({ done: true, earned: 0 });
    expect(
      db.select().from(creditLedger).where(eq(creditLedger.userId, userId)).all()
    ).toHaveLength(0);
    expect(await db.select().from(guideTasks).where(eq(guideTasks.userId, userId))).toHaveLength(1);
  });
});
