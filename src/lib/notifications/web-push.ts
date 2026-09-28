import webpush, { WebPushError } from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { pushSubscriptions, serverSecrets } from "@/lib/db/schema";
import { decryptValue, encryptValue } from "@/lib/crypto";
import { APP_DOMAIN } from "@/constants";
import { DELIVERY_TIMEOUT_MS, PUSH_TTL_SECONDS } from "./constants";

type VapidKeys = { publicKey: string; privateKey: string };

const VAPID_SECRET_NAME = "vapid_keys";

let cachedKeys: VapidKeys | null = null;

// Created once and kept forever: devices only accept pushes signed with the key they subscribed with
export function getVapidKeys(): VapidKeys {
  if (cachedKeys) return cachedKeys;
  const generated = webpush.generateVAPIDKeys();
  db.insert(serverSecrets)
    .values({ name: VAPID_SECRET_NAME, value: encryptValue(JSON.stringify(generated)) })
    .onConflictDoNothing()
    .run();
  const row = db
    .select()
    .from(serverSecrets)
    .where(eq(serverSecrets.name, VAPID_SECRET_NAME))
    .get();
  if (!row) throw new Error("web push keys could not be stored");
  cachedKeys = JSON.parse(decryptValue(row.value)) as VapidKeys;
  return cachedKeys;
}

function vapidSubject(): string {
  const appUrl = process.env.APP_URL;
  return appUrl?.startsWith("https://") ? appUrl : `mailto:noreply@${APP_DOMAIN}`;
}

export type PushPayload = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  actions?: { action: string; title: string; token: string }[];
};

export async function sendWebPush(userId: number, payload: PushPayload): Promise<void> {
  const devices = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  if (devices.length === 0) throw new Error("no device has push turned on");

  const keys = getVapidKeys();
  const results = await Promise.allSettled(
    devices.map((device) =>
      webpush.sendNotification(
        { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
        JSON.stringify(payload),
        {
          TTL: PUSH_TTL_SECONDS,
          urgency: "high",
          timeout: DELIVERY_TIMEOUT_MS,
          vapidDetails: { subject: vapidSubject(), ...keys },
        }
      )
    )
  );

  // 404/410: the browser dropped this subscription (app removed, site data cleared)
  const gone = devices.filter((device, i) => {
    const result = results[i];
    return (
      result?.status === "rejected" &&
      result.reason instanceof WebPushError &&
      (result.reason.statusCode === 404 || result.reason.statusCode === 410)
    );
  });
  if (gone.length > 0) {
    await db.delete(pushSubscriptions).where(
      inArray(
        pushSubscriptions.id,
        gone.map((d) => d.id)
      )
    );
  }

  if (results.some((r) => r.status === "fulfilled")) return;
  const reasons = results.map((r, i) => {
    const reason = r.status === "rejected" ? (r.reason as unknown) : null;
    const detail =
      reason instanceof WebPushError
        ? `${reason.statusCode} ${reason.body || reason.message}`.trim()
        : reason instanceof Error
          ? reason.message
          : String(reason);
    return `${devices[i]?.deviceName ?? "device"}: ${detail}`;
  });
  throw new Error(
    gone.length === devices.length
      ? "every device's push subscription has expired — turn push on again"
      : `push failed (${reasons.join("; ")})`
  );
}
