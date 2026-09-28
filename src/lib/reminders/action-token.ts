import { createHmac, timingSafeEqual } from "node:crypto";
import { QUICK_REMIND_VALUES, REMINDER_ACTION_TTL_MS } from "@/lib/notifications/constants";
import type { QuickRemindChoice } from "@/lib/notifications/constants";

export type ReminderAction = "done" | QuickRemindChoice;

export type ReminderActionClaim = {
  userId: number;
  itemId: number;
  action: ReminderAction;
  // The deadline the reminder was about; a later occurrence or a moved date makes the button outdated
  deadline: number | null;
};

type Payload = { u: number; i: number; a: ReminderAction; d: number | null; e: number };

function signature(body: string): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const key = createHmac("sha256", secret).update("reminder-action").digest();
  return createHmac("sha256", key).update(body).digest();
}

export function signReminderAction(claim: ReminderActionClaim, now = new Date()): string {
  const payload: Payload = {
    u: claim.userId,
    i: claim.itemId,
    a: claim.action,
    d: claim.deadline,
    e: now.getTime() + REMINDER_ACTION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signature(body).toString("base64url")}`;
}

export function verifyReminderAction(token: string, now = new Date()): ReminderActionClaim | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = signature(body);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    const knownAction = p.a === "done" || QUICK_REMIND_VALUES.includes(p.a);
    if (!knownAction || typeof p.e !== "number" || p.e < now.getTime()) return null;
    return { userId: p.u, itemId: p.i, action: p.a, deadline: p.d };
  } catch {
    return null;
  }
}
