import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { authRateLimits } from "@/lib/db/schema";
import {
  OTP_SEND_MAX,
  OTP_SEND_WINDOW_MS,
  OTP_VERIFY_LOCKOUT_MS,
  OTP_VERIFY_MAX,
} from "./constants";

async function getRateLimit(email: string) {
  return db.query.authRateLimits.findFirst({ where: eq(authRateLimits.email, email) });
}

async function upsertRateLimit(email: string, data: Partial<typeof authRateLimits.$inferInsert>) {
  await db
    .insert(authRateLimits)
    .values({ email, ...data })
    .onConflictDoUpdate({ target: authRateLimits.email, set: { ...data, updatedAt: new Date() } });
}

export async function allowCodeSend(email: string): Promise<boolean> {
  const record = await getRateLimit(email);
  const now = Date.now();
  const windowStart = record?.otpSendWindowStart?.getTime() ?? 0;
  const withinWindow = now - windowStart < OTP_SEND_WINDOW_MS;
  const sendCount = withinWindow ? (record?.otpSendCount ?? 0) : 0;
  if (sendCount >= OTP_SEND_MAX) return false;
  await upsertRateLimit(email, {
    otpSendCount: sendCount + 1,
    otpSendWindowStart: withinWindow ? record?.otpSendWindowStart : new Date(),
  });
  return true;
}

export async function isCodeEntryLocked(email: string): Promise<boolean> {
  const record = await getRateLimit(email);
  return !!record?.lockedUntil && record.lockedUntil > new Date();
}

export async function recordCodeFailure(email: string): Promise<void> {
  const record = await getRateLimit(email);
  const failCount = (record?.verifyFailCount ?? 0) + 1;
  const locked = failCount >= OTP_VERIFY_MAX;
  await upsertRateLimit(email, {
    verifyFailCount: locked ? 0 : failCount,
    lockedUntil: locked ? new Date(Date.now() + OTP_VERIFY_LOCKOUT_MS) : null,
  });
}

export async function recordCodeSuccess(email: string): Promise<void> {
  await upsertRateLimit(email, { verifyFailCount: 0, lockedUntil: null });
}
