"use server";

import type { ActionResult } from "@/types/result";
import { revalidatePath } from "next/cache";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { getVapidKeys } from "@/lib/notifications/web-push";
import { PUSH_DEVICE_NAME_MAX_LENGTH, PUSH_DEVICES_MAX } from "@/lib/notifications/constants";

export type PushDevice = { id: number; name: string; endpoint: string; addedAt: Date };

export async function getPushSetupAction(): Promise<
  ActionResult<{ publicKey: string; devices: PushDevice[] }>
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const devices = await db
    .select({
      id: pushSubscriptions.id,
      name: pushSubscriptions.deviceName,
      endpoint: pushSubscriptions.endpoint,
      addedAt: pushSubscriptions.createdAt,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, session.userId))
    .orderBy(asc(pushSubscriptions.id));
  return { ok: true, publicKey: getVapidKeys().publicKey, devices };
}

const base64Url = z
  .string()
  .regex(/^[A-Za-z0-9_-]+={0,2}$/)
  .max(256);

const SubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(2048),
  keys: z.object({ p256dh: base64Url, auth: base64Url }),
});

export async function savePushDeviceAction(
  subscription: unknown,
  deviceName: string
): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const parsed = SubscriptionSchema.safeParse(subscription);
  if (!parsed.success)
    return { ok: false, error: "this browser sent an invalid push subscription" };
  const { endpoint, keys } = parsed.data;

  const [others] = await db
    .select({ n: count() })
    .from(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.userId, session.userId), ne(pushSubscriptions.endpoint, endpoint))
    );
  if ((others?.n ?? 0) >= PUSH_DEVICES_MAX) {
    return { ok: false, error: `remove a device first (max ${PUSH_DEVICES_MAX})` };
  }

  const name = deviceName.trim().slice(0, PUSH_DEVICE_NAME_MAX_LENGTH) || "this device";
  const values = { userId: session.userId, p256dh: keys.p256dh, auth: keys.auth, deviceName: name };
  await db
    .insert(pushSubscriptions)
    .values({ endpoint, ...values })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });

  revalidatePath("/");
  return { ok: true };
}

export async function removePushDeviceAction(id: number): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.id, id), eq(pushSubscriptions.userId, session.userId)));
  revalidatePath("/");
  return { ok: true };
}
