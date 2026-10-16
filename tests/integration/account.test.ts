import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bucketMembers,
  buckets,
  chatMessages,
  chatSessions,
  items,
  otps,
  userSettings,
  users,
} from "@/lib/db/schema";
import { buildAccountExport } from "@/lib/account/export";
import { deleteAccountAction, sendAccountDeletionCodeAction } from "@/app/(app)/account-actions";
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

async function signIn() {
  const userId = await seedUser();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  session.userId = userId;
  session.email = user?.email ?? "";
  return userId;
}

describe("data export", () => {
  it("contains the user's buckets, items and chats but never their secrets", async () => {
    const userId = await signIn();
    const bucketId = await seedBucket(userId);
    await seedItem(userId, bucketId, { deadline: T0, title: "pay rent" });
    await db
      .update(userSettings)
      .set({
        aiApiKey: "SECRET-AI-KEY",
        smtpPass: "SECRET-SMTP-PASS",
        telegramLinkCodeHash: "SECRET-LINK-HASH",
        transcriptionApiKey: "SECRET-TRANSCRIPTION-KEY",
      })
      .where(eq(userSettings.userId, userId));
    await db
      .update(buckets)
      .set({ webhookKey: "SECRET-WEBHOOK-KEY", mcpConfig: "SECRET-MCP-CONFIG" })
      .where(eq(buckets.id, bucketId));
    const [chat] = await db
      .insert(chatSessions)
      .values({ userId, title: "planning", source: "web" })
      .returning();
    await db
      .insert(chatMessages)
      .values({ sessionId: chat.id, userId, role: "user", content: "hi capy" });

    const data = await buildAccountExport(userId, T0);

    expect(data.account.email).toBe(session.email);
    expect(data.items.map((i) => i.title)).toEqual(["pay rent"]);
    expect(data.buckets[0]).toMatchObject({
      id: bucketId,
      webhookEnabled: true,
      yourChannels: { medium: ["telegram"], webhooks: [] },
    });
    expect(data.chats).toEqual([
      expect.objectContaining({
        title: "planning",
        messages: [expect.objectContaining({ content: "hi capy" })],
      }),
    ]);
    expect(JSON.stringify(data)).not.toMatch(/SECRET-/);
  });

  describe("shared buckets", () => {
    async function sharedBucket() {
      const owner = await seedUser();
      const member = await seedUser();
      await db.update(users).set({ displayName: "Ana" }).where(eq(users.id, owner));
      await db.update(users).set({ displayName: "Sam" }).where(eq(users.id, member));
      const bucketId = await seedBucket(owner);
      await db.insert(bucketMembers).values({ bucketId, userId: member });
      await db
        .update(buckets)
        .set({ webhookKey: "SECRET-WEBHOOK-KEY", telegramConfig: '{"chat":"SECRET-TELEGRAM"}' })
        .where(eq(buckets.id, bucketId));
      const ownerItem = await seedItem(owner, bucketId, { deadline: T0, title: "book flights" });
      await db.update(items).set({ assigneeId: member }).where(eq(items.id, ownerItem));
      await seedItem(member, bucketId, { deadline: T0, title: "buy milk" });
      return { owner, member, bucketId };
    }

    it("a member gets the joined bucket with everyone's items, without its owner's secrets", async () => {
      const { member, bucketId } = await sharedBucket();

      const data = await buildAccountExport(member, T0);

      expect(data.buckets).toEqual([
        expect.objectContaining({
          id: bucketId,
          owner: "Ana",
          telegram: null,
          webhookEnabled: null,
        }),
      ]);
      expect(data.items).toEqual([
        expect.objectContaining({
          bucketId,
          title: "book flights",
          addedBy: "Ana",
          assignedTo: "you",
        }),
        expect.objectContaining({
          bucketId,
          title: "buy milk",
          addedBy: "you",
          assignedTo: null,
        }),
      ]);
      expect(JSON.stringify(data)).not.toMatch(/SECRET-/);
    });

    it("the owner gets the items members added to their bucket", async () => {
      const { owner, bucketId } = await sharedBucket();

      const data = await buildAccountExport(owner, T0);

      expect(data.buckets).toEqual([
        expect.objectContaining({ id: bucketId, owner: "you", webhookEnabled: true }),
      ]);
      expect(data.items.map((i) => [i.title, i.addedBy, i.assignedTo])).toEqual([
        ["book flights", "you", "Sam"],
        ["buy milk", "Sam", null],
      ]);
    });

    it("leaves out joined buckets the member can't open: archived, deleted or left", async () => {
      const { owner, member, bucketId } = await sharedBucket();
      const archived = await seedBucket(owner);
      const deleted = await seedBucket(owner);
      await db.insert(bucketMembers).values([
        { bucketId: archived, userId: member },
        { bucketId: deleted, userId: member },
      ]);
      await seedItem(member, archived, { deadline: T0, title: "in archived" });
      await seedItem(member, deleted, { deadline: T0, title: "in deleted" });
      await db.update(buckets).set({ archivedAt: T0 }).where(eq(buckets.id, archived));
      await db.update(buckets).set({ deletedAt: T0 }).where(eq(buckets.id, deleted));

      expect((await buildAccountExport(member, T0)).buckets.map((b) => b.id)).toEqual([bucketId]);

      await db.delete(bucketMembers).where(eq(bucketMembers.userId, member));
      const afterLeaving = await buildAccountExport(member, T0);

      expect(afterLeaving.buckets).toEqual([]);
      expect(afterLeaving.items).toEqual([]);
      expect((await buildAccountExport(owner, T0)).items.map((i) => i.title)).toEqual([
        "book flights",
        "buy milk",
        "in archived",
        "in deleted",
      ]);
    });
  });
});

describe("account deletion", () => {
  it("a wrong code deletes nothing", async () => {
    const userId = await signIn();
    await sendAccountDeletionCodeAction();

    expect(await deleteAccountAction("000000")).toEqual({
      ok: false,
      error: "Wrong or expired code.",
    });
    expect(await db.query.users.findFirst({ where: eq(users.id, userId) })).toBeDefined();
  });

  it("locks code entry after five wrong codes", async () => {
    await signIn();
    await sendAccountDeletionCodeAction();
    for (let i = 0; i < 5; i++) await deleteAccountAction("000000");

    expect(await deleteAccountAction("000000")).toEqual({
      ok: false,
      error: "Too many wrong codes. Try again in 15 minutes.",
    });
  });

  it("the right code deletes the account and everything in it, and nothing of anyone else", async () => {
    const other = await seedUser();
    const otherBucket = await seedBucket(other);
    await seedItem(other, otherBucket, { deadline: T0 });

    const userId = await signIn();
    const bucketId = await seedBucket(userId);
    await seedItem(userId, bucketId, { deadline: T0 });
    const sent = await sendAccountDeletionCodeAction();
    const code = sent.ok ? (sent.devCode ?? "") : "";

    await expect(deleteAccountAction(code)).rejects.toThrow(/NEXT_REDIRECT/);

    expect(await db.query.users.findFirst({ where: eq(users.id, userId) })).toBeUndefined();
    expect(await db.select().from(buckets).where(eq(buckets.userId, userId))).toEqual([]);
    expect(await db.select().from(items).where(eq(items.userId, userId))).toEqual([]);
    expect(await db.select().from(otps).where(eq(otps.email, session.email))).toEqual([]);
    expect(await db.select().from(items).where(eq(items.userId, other))).toHaveLength(1);
  });
});
