import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
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
    expect(data.buckets[0]).toMatchObject({ id: bucketId, webhookEnabled: true });
    expect(data.chats).toEqual([
      expect.objectContaining({
        title: "planning",
        messages: [expect.objectContaining({ content: "hi capy" })],
      }),
    ]);
    expect(JSON.stringify(data)).not.toMatch(/SECRET-/);
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
