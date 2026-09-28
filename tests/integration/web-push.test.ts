import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import type * as WebPushModule from "web-push";
import { WebPushError } from "web-push";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationQueue, pushSubscriptions, serverSecrets } from "@/lib/db/schema";
import { enqueue, processPending } from "@/lib/notifications/queue";
import { getWorkingChannels } from "@/lib/notifications/channels";
import { getVapidKeys } from "@/lib/notifications/web-push";
import { removePushDeviceAction, savePushDeviceAction } from "@/app/(app)/push-actions";
import {
  HOUR,
  resetSchedulerEnvironment,
  runSchedulerAt,
  seedBucket,
  seedItem,
  seedUser,
  useSchedulerEnvironment,
} from "./helpers";

const sendNotification = vi.hoisted(() => vi.fn());
vi.mock("web-push", async (importOriginal) => {
  const actual = await importOriginal<typeof WebPushModule & { default: typeof WebPushModule }>();
  return { ...actual, default: { ...actual.default, sendNotification } };
});

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const T0 = new Date("2026-03-10T12:00:00Z");

beforeEach(() => {
  useSchedulerEnvironment(T0);
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({ statusCode: 201, body: "", headers: {} });
});
afterEach(() => resetSchedulerEnvironment());

let deviceCount = 0;
async function addDevice(userId: number, name = "Chrome on Android") {
  deviceCount += 1;
  const [row] = await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: `https://push.example.com/send/${deviceCount}`,
      p256dh: "BPublicKey",
      auth: "authSecret",
      deviceName: name,
    })
    .returning();
  return row;
}

async function queueRows(userId: number) {
  return db
    .select()
    .from(notificationQueue)
    .where(and(eq(notificationQueue.userId, userId), eq(notificationQueue.medium, "push")));
}

function goneError(endpoint: string) {
  return new WebPushError("Received unexpected response code", 410, {}, "expired", endpoint);
}

describe("server keys", () => {
  it("are generated once and reused, so existing devices keep working", async () => {
    const first = getVapidKeys();
    const second = getVapidKeys();
    expect(second).toEqual(first);
    const rows = await db.select().from(serverSecrets);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.value).toContain(first.publicKey);
  });
});

describe("push as a channel", () => {
  it("only counts as set up once a device has turned it on", async () => {
    const userId = await seedUser();
    expect(await getWorkingChannels(userId)).not.toContain("push");

    await addDevice(userId);

    expect(await getWorkingChannels(userId)).toContain("push");
  });

  it("a bucket reminder reaches every device of the user", async () => {
    const userId = await seedUser();
    await addDevice(userId, "Chrome on Android");
    await addDevice(userId, "Firefox on Linux");
    const bucketId = await seedBucket(userId, { medium: ["push"], repeat: "once" });
    const itemId = await seedItem(userId, bucketId, {
      deadline: new Date(T0.getTime() + HOUR),
      title: "pay rent",
    });

    await runSchedulerAt(new Date(T0.getTime() + HOUR));

    const [job] = await queueRows(userId);
    expect(job?.medium).toBe("push");
    expect(job?.status).toBe("sent");
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [, payload, options] = sendNotification.mock.calls[0] as [unknown, string, never];
    expect(JSON.parse(payload)).toMatchObject({ tag: `item-${itemId}` });
    expect(JSON.parse(payload).title).toContain("pay rent");
    expect(options).toMatchObject({ urgency: "high", TTL: 86400 });
  });

  it("a device the browser dropped is removed, and the others still get it", async () => {
    const userId = await seedUser();
    const dropped = await addDevice(userId);
    const kept = await addDevice(userId);
    sendNotification.mockImplementation(async (sub: { endpoint: string }) => {
      if (sub.endpoint === dropped.endpoint) throw goneError(sub.endpoint);
      return { statusCode: 201, body: "", headers: {} };
    });

    await enqueue({ userId, medium: "push", title: "t", message: "m" });
    await processPending();

    const [job] = await queueRows(userId);
    expect(job?.status).toBe("sent");
    const left = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
    expect(left.map((d) => d.id)).toEqual([kept.id]);
  });

  it("fails with a clear reason when no device can receive it", async () => {
    const userId = await seedUser();
    await enqueue({ userId, medium: "push", title: "t", message: "m" });
    await processPending();
    expect((await queueRows(userId))[0]?.lastError).toBe("no device has push turned on");

    const other = await seedUser();
    await addDevice(other);
    sendNotification.mockRejectedValue(new Error("socket hang up"));
    await enqueue({ userId: other, medium: "push", title: "t", message: "m" });
    await processPending();
    const [job] = await queueRows(other);
    expect(job?.status).toBe("pending");
    expect(job?.lastError).toContain("socket hang up");
  });
});

describe("turning push on and off", () => {
  const subscription = (endpoint: string) => ({
    endpoint,
    expirationTime: null,
    keys: {
      p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u",
      auth: "tBHItJI5svbpez7KI4CCXg",
    },
  });

  it("saves the device, and saving it again updates instead of duplicating", async () => {
    session.userId = await seedUser();
    const sub = subscription("https://fcm.googleapis.com/fcm/send/abc");

    expect(await savePushDeviceAction(sub, "Chrome on Android")).toEqual({ ok: true });
    expect(await savePushDeviceAction(sub, "Chrome on Android")).toEqual({ ok: true });

    const rows = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, sub.endpoint));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ userId: session.userId, deviceName: "Chrome on Android" });
  });

  it("a shared browser belongs to whoever turned push on last", async () => {
    const sub = subscription("https://fcm.googleapis.com/fcm/send/shared");
    const first = await seedUser();
    session.userId = first;
    await savePushDeviceAction(sub, "Chrome on Linux");

    const second = await seedUser();
    session.userId = second;
    await savePushDeviceAction(sub, "Chrome on Linux");

    const [row] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, sub.endpoint));
    expect(row?.userId).toBe(second);
  });

  it("rejects anything that isn't an https push subscription", async () => {
    session.userId = await seedUser();
    const plainHttp = await savePushDeviceAction(subscription("http://internal:8080/x"), "x");
    const noKeys = await savePushDeviceAction({ endpoint: "https://push.example.com/x" }, "x");
    expect(plainHttp.ok).toBe(false);
    expect(noKeys.ok).toBe(false);
  });

  it("only removes the user's own devices", async () => {
    const owner = await seedUser();
    const device = await addDevice(owner);
    session.userId = await seedUser();

    await removePushDeviceAction(device.id);
    expect(
      await db
        .select()
        .from(pushSubscriptions)
        .where(and(eq(pushSubscriptions.id, device.id), eq(pushSubscriptions.userId, owner)))
    ).toHaveLength(1);

    session.userId = owner;
    await removePushDeviceAction(device.id);
    expect(
      await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.id, device.id))
    ).toHaveLength(0);
  });
});
