import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, notificationQueue, systemErrors, users } from "@/lib/db/schema";
import { pruneSystemErrors, recordSystemError } from "@/lib/system-errors";
import { sendErrorDigest } from "@/lib/admin-alerts";
import { callsTo, stubTelegram } from "./telegram-helpers";
import { userSettings } from "@/lib/db/schema";
import { getSystemStatusAction } from "@/app/(app)/system-actions";
import {
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

beforeEach(async () => {
  useSchedulerEnvironment(T0);
  await db.delete(systemErrors);
});
afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  resetSchedulerEnvironment();
});

async function signIn() {
  session.userId = await seedUser();
  session.email =
    (await db.query.users.findFirst({ where: eq(users.id, session.userId) }))?.email ?? "";
}

it("records an error with its user, and prunes ones older than two weeks", async () => {
  const userId = await seedUser();
  recordSystemError("scheduler", "boom", { userId });
  await db.insert(systemErrors).values({
    source: "scheduler",
    message: "old",
    createdAt: new Date(T0.getTime() - 15 * 24 * 60 * 60 * 1000),
  });

  await pruneSystemErrors(T0);

  const rows = await db.select().from(systemErrors);
  expect(rows).toEqual([expect.objectContaining({ source: "scheduler", message: "boom", userId })]);
});

it("a reminder that fails during a run shows up in the log with its user", async () => {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  await seedItem(userId, bucketId, { deadline: T0 });
  await db.update(buckets).set({ notificationsRules: "{broken" }).where(eq(buckets.id, bucketId));

  await runSchedulerAt(T0);

  const [row] = await db.select().from(systemErrors).where(eq(systemErrors.source, "scheduler"));
  expect(row).toMatchObject({ userId });
  expect(row.message).toMatch(/^item \d+ failed: /);
});

it("only admins can see the system status", async () => {
  await signIn();
  expect(await getSystemStatusAction()).toEqual({ ok: false, error: "Not allowed" });

  process.env.ADMIN_EMAILS = session.email;
  recordSystemError("backup", "backup failed: disk full");
  await db.insert(notificationQueue).values({
    userId: session.userId,
    medium: "email",
    title: "t",
    message: "m",
    status: "dead",
    createdAt: new Date(T0.getTime() - 60 * 60 * 1000),
  });

  const result = await getSystemStatusAction();
  expect(result.ok && result.status.failedDeliveriesLastDay).toBe(1);
  expect(result.ok && result.status.errors.map((e) => e.message)).toEqual([
    "backup failed: disk full",
  ]);
});

async function makeAdmin(): Promise<number> {
  const userId = await seedUser();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  process.env.ADMIN_EMAILS = user?.email ?? "";
  await db
    .update(userSettings)
    .set({ telegramChatId: "9001" })
    .where(eq(userSettings.userId, userId));
  return userId;
}

describe("error details", () => {
  it("keeps the stack, what was being worked on, and where it ran", () => {
    const row = recordSystemError("scheduler", "item 7 failed: boom", {
      err: new Error("boom"),
      context: { itemId: 7, step: "reminder" },
    });

    const details = JSON.parse(row?.details ?? "{}") as {
      stack: string;
      context: unknown;
      runtime: { uptimeSec: number };
    };
    expect(details.stack).toMatch(/^Error: boom\n\s+at /);
    expect(details.context).toEqual({ itemId: 7, step: "reminder" });
    expect(details.runtime.uptimeSec).toBeGreaterThanOrEqual(0);
  });
});

describe("admin alerts", () => {
  it("a critical error messages the admins right away, with its details", async () => {
    const api = stubTelegram();
    await makeAdmin();

    const row = recordSystemError("backup", "backup failed: disk full", {
      level: "critical",
      err: new Error("disk full"),
      context: { database: "/data/heycapy.db" },
    });

    await vi.waitFor(() => expect(callsTo(api, "sendMessage")).toHaveLength(1));
    const text = String(callsTo(api, "sendMessage")[0].text);
    expect(text).toMatch(/^\[HeyCapy\] critical: backup — backup failed: disk full/);
    expect(text).toContain('context: {"database":"/data/heycapy.db"}');
    expect(text).toContain("Error: disk full");
    await vi.waitFor(async () => {
      const saved = await db.query.systemErrors.findFirst({
        where: eq(systemErrors.id, row?.id ?? 0),
      });
      expect(saved?.alertedAt).not.toBeNull();
    });
  });

  it("everything else goes out once, in an hourly digest grouped by source", async () => {
    const api = stubTelegram();
    await makeAdmin();
    recordSystemError("telegram", "update failed: a");
    recordSystemError("telegram", "update failed: b");
    recordSystemError("reminders", "item 3: invalid notification rules");

    await sendErrorDigest();
    await sendErrorDigest();

    const sent = callsTo(api, "sendMessage").map((m) => String(m.text));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatch(/^\[HeyCapy\] 3 new server errors \(2× telegram, 1× reminders\)/);
    expect(sent[0]).toContain("update failed: b");
  });

  it("with no admins configured nothing is sent and errors wait", async () => {
    const api = stubTelegram();
    recordSystemError("telegram", "update failed");

    await sendErrorDigest();

    expect(callsTo(api, "sendMessage")).toEqual([]);
    const [row] = await db.select().from(systemErrors);
    expect(row.alertedAt).toBeNull();
  });
});
