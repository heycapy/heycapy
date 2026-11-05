import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { encryptValue } from "@/lib/crypto";
import { POST as postWebhook } from "@/app/api/webhook/[bucketId]/route";
import {
  resetSchedulerEnvironment,
  seedBucket,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const KEY = "hc_live_webhookstatus";

beforeEach(() => useSchedulerEnvironment(new Date("2026-03-10T12:00:00Z")));
afterEach(() => resetSchedulerEnvironment());

async function setup() {
  const userId = await seedUser();
  const bucketId = await seedBucket(userId);
  await db
    .update(buckets)
    .set({ webhookKey: encryptValue(KEY) })
    .where(eq(buckets.id, bucketId));
  return bucketId;
}

function post(bucketId: number, body: Record<string, unknown>) {
  return postWebhook(
    new Request(`http://localhost/api/webhook/${bucketId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ bucketId: String(bucketId) }) }
  );
}

async function latestStatus(bucketId: number): Promise<string | undefined> {
  const [row] = await db
    .select({ status: items.status })
    .from(items)
    .where(eq(items.bucketId, bucketId))
    .orderBy(desc(items.id))
    .limit(1);
  return row?.status;
}

describe("incoming webhook status", () => {
  it("saves a valid status", async () => {
    const bucketId = await setup();
    expect((await post(bucketId, { title: "rent", status: "completed" })).status).toBe(201);
    expect(await latestStatus(bucketId)).toBe("completed");
  });

  it("treats the removed on hold as active, so older callers keep working", async () => {
    const bucketId = await setup();
    expect((await post(bucketId, { title: "rent", status: "on hold" })).status).toBe(201);
    expect(await latestStatus(bucketId)).toBe("active");
  });

  it("refuses a status that doesn't exist", async () => {
    const bucketId = await setup();
    const res = await post(bucketId, { title: "rent", status: "paused" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: 'invalid status "paused" — valid values: active, completed',
    });
    expect(await latestStatus(bucketId)).toBeUndefined();
  });
});
