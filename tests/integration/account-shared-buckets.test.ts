import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, items, users } from "@/lib/db/schema";
import {
  deleteAccountAction,
  getDeletionBlockersAction,
  sendAccountDeletionCodeAction,
} from "@/app/(app)/account-actions";
import { deleteAccount } from "@/lib/account/delete";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
  deleteSession: async () => {},
}));

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => {
  useSchedulerEnvironment(T0);
  process.env.E2E_TEST_MODE = "1";
});
afterEach(() => {
  delete process.env.E2E_TEST_MODE;
  resetSchedulerEnvironment();
});

async function signInAs(userId: number) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  session.userId = userId;
  session.email = user?.email ?? "";
}

async function sharedBucket(name = "Home") {
  const owner = await seedUser();
  const member = await seedUser();
  const bucketId = await seedBucket(owner);
  await db.update(buckets).set({ name }).where(eq(buckets.id, bucketId));
  await db.insert(bucketMembers).values({ bucketId, userId: member });
  return { owner, member, bucketId };
}

async function deletionCode(): Promise<string> {
  const sent = await sendAccountDeletionCodeAction();
  if (!sent.ok) throw new Error(sent.error);
  return sent.devCode ?? "";
}

const exists = async (userId: number) =>
  (await db.query.users.findFirst({ where: eq(users.id, userId) })) !== undefined;

describe("an owner who still shares a bucket", () => {
  it("is told which buckets are in the way, and gets no code", async () => {
    const { owner } = await sharedBucket("Home");
    await signInAs(owner);

    const blockers = await getDeletionBlockersAction();
    expect(blockers.ok && blockers.buckets.map((b) => b.name)).toEqual(["Home"]);
    expect(await sendAccountDeletionCodeAction()).toEqual({
      ok: false,
      error: "You own shared buckets (Home). Delete them or remove their members first.",
    });
  });

  it("cannot delete the account even with a code from before the bucket was shared", async () => {
    const owner = await seedUser();
    const bucketId = await seedBucket(owner);
    await signInAs(owner);
    const code = await deletionCode();
    await db.insert(bucketMembers).values({ bucketId, userId: await seedUser() });

    const result = await deleteAccountAction(code);

    expect(result).toMatchObject({ ok: false });
    expect(await exists(owner)).toBe(true);
    expect(await db.select().from(buckets).where(eq(buckets.id, bucketId))).toHaveLength(1);
  });

  it("is stopped inside the delete itself, so a member joining at the last moment still counts", async () => {
    const { owner, bucketId } = await sharedBucket();
    const ownerRow = await db.query.users.findFirst({ where: eq(users.id, owner) });

    expect(deleteAccount(owner, ownerRow?.email ?? "")).toMatchObject([{ id: bucketId }]);

    expect(await exists(owner)).toBe(true);
  });

  it("can delete once everyone has left, or once the bucket is gone", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    await signInAs(owner);
    await db.delete(bucketMembers).where(eq(bucketMembers.userId, member));

    await expect(deleteAccountAction(await deletionCode())).rejects.toThrow(/NEXT_REDIRECT/);
    expect(await exists(owner)).toBe(false);
    expect(await db.select().from(buckets).where(eq(buckets.id, bucketId))).toEqual([]);

    const second = await sharedBucket();
    await db.update(buckets).set({ deletedAt: T0 }).where(eq(buckets.id, second.bucketId));
    await signInAs(second.owner);
    await expect(deleteAccountAction(await deletionCode())).rejects.toThrow(/NEXT_REDIRECT/);
    expect(await exists(second.owner)).toBe(false);
  });

  it("is still blocked by an archived shared bucket", async () => {
    const { owner, bucketId } = await sharedBucket();
    await db.update(buckets).set({ archivedAt: T0 }).where(eq(buckets.id, bucketId));
    await signInAs(owner);

    expect(await sendAccountDeletionCodeAction()).toMatchObject({ ok: false });
  });
});

describe("a member deleting their account", () => {
  it("leaves the bucket whole and hands what they added to its owner", async () => {
    const { owner, member, bucketId } = await sharedBucket();
    const added = await seedItem(member, bucketId, { deadline: T0, title: "added by member" });
    const mine = await seedItem(member, await seedBucket(member), { deadline: T0 });
    await signInAs(member);

    await expect(deleteAccountAction(await deletionCode())).rejects.toThrow(/NEXT_REDIRECT/);

    expect(await exists(member)).toBe(false);
    expect(await exists(owner)).toBe(true);
    const [kept] = await db.select().from(items).where(eq(items.id, added));
    expect(kept).toMatchObject({ bucketId, userId: owner, title: "added by member" });
    expect(await db.select().from(items).where(eq(items.id, mine))).toEqual([]);
    const members = await db
      .select({ userId: bucketMembers.userId })
      .from(bucketMembers)
      .where(eq(bucketMembers.bucketId, bucketId));
    expect(members).toEqual([{ userId: owner }]);
  });
});
