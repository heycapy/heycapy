"use server";

import { z } from "zod";
import { createOtp, verifyOtp } from "@/lib/auth/otp";
import { buildOtpEmail } from "@/lib/auth/otpEmail";
import { sendEmail } from "@/lib/notifications/email";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users, userSettings, authRateLimits } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { seed } from "@/lib/db/seed";

type SendOtpResult = { ok: true; devCode?: string } | { ok: false; error: string };
type VerifyOtpResult = { ok: true } | { ok: false; error: string };

const OTP_SEND_MAX = 3;
const OTP_SEND_WINDOW_MS = 5 * 60 * 1000;
const OTP_VERIFY_MAX = 5;
const OTP_VERIFY_LOCKOUT_MS = 15 * 60 * 1000;

const EmailSchema = z.email();

async function getRateLimit(email: string) {
  return db.query.authRateLimits.findFirst({
    where: eq(authRateLimits.email, email),
  });
}

async function upsertRateLimit(email: string, data: Partial<typeof authRateLimits.$inferInsert>) {
  await db
    .insert(authRateLimits)
    .values({ email, ...data })
    .onConflictDoUpdate({ target: authRateLimits.email, set: { ...data, updatedAt: new Date() } });
}

export async function sendOtpAction(email: string): Promise<SendOtpResult> {
  if (!EmailSchema.safeParse(email).success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const isDev = !process.env.RESEND_API_KEY && !process.env.SMTP_HOST;

  const record = await getRateLimit(email);
  const now = Date.now();
  const windowStart = record?.otpSendWindowStart?.getTime() ?? 0;
  const withinWindow = now - windowStart < OTP_SEND_WINDOW_MS;
  const sendCount = withinWindow ? (record?.otpSendCount ?? 0) : 0;

  if (sendCount >= OTP_SEND_MAX) {
    return { ok: false, error: "Too many attempts. Try again in 5 minutes." };
  }

  await upsertRateLimit(email, {
    otpSendCount: sendCount + 1,
    otpSendWindowStart: withinWindow ? record?.otpSendWindowStart : new Date(),
  });

  const code = await createOtp(email);

  if (isDev) {
    process.stderr.write(`[heycapy] OTP for ${email}: ${code}\n`);
    return { ok: true, devCode: code };
  }

  try {
    const emailPayload = await buildOtpEmail(code);
    await sendEmail({ to: email, ...emailPayload });
  } catch {
    return { ok: false, error: "Failed to send code. Please try again." };
  }

  return { ok: true };
}

export async function verifyOtpAction(email: string, code: string): Promise<VerifyOtpResult> {
  if (!EmailSchema.safeParse(email).success) {
    return { ok: false, error: "Invalid request." };
  }

  const record = await getRateLimit(email);
  const now = new Date();

  if (record?.lockedUntil && record.lockedUntil > now) {
    return { ok: false, error: "Too many failed attempts. Try again in 15 minutes." };
  }

  const valid = await verifyOtp(email, code);

  if (!valid) {
    const failCount = (record?.verifyFailCount ?? 0) + 1;
    await upsertRateLimit(email, {
      verifyFailCount: failCount >= OTP_VERIFY_MAX ? 0 : failCount,
      lockedUntil:
        failCount >= OTP_VERIFY_MAX ? new Date(Date.now() + OTP_VERIFY_LOCKOUT_MS) : null,
    });
    return { ok: false, error: "Invalid or expired code. Try again." };
  }

  await upsertRateLimit(email, { verifyFailCount: 0, lockedUntil: null });

  let user = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!user) {
    const [created] = await db.insert(users).values({ email }).returning();
    user = created;
    await db.insert(userSettings).values({ userId: user.id });
    await seed(user.id);
  }

  await createSession({ userId: user.id, email: user.email });
  return { ok: true };
}
