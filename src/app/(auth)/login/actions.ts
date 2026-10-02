"use server";

import type { ActionResult } from "@/types/result";
import { z } from "zod";
import { codesShownOnScreen, createOtp, verifyOtp } from "@/lib/auth/otp";
import { buildOtpEmail } from "@/lib/auth/otpEmail";
import { sendEmail } from "@/lib/notifications/email";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users, userSettings } from "@/lib/db/schema";
import {
  allowCodeSend,
  isCodeEntryLocked,
  recordCodeFailure,
  recordCodeSuccess,
} from "@/lib/auth/rate-limit";
import { eq } from "drizzle-orm";
import { seed } from "@/lib/db/seed";

type SendOtpResult = ActionResult<{ devCode?: string }>;
type VerifyOtpResult = ActionResult;

const EmailSchema = z.email();

export async function sendOtpAction(email: string): Promise<SendOtpResult> {
  if (!EmailSchema.safeParse(email).success) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const isDev = codesShownOnScreen();

  if (!(await allowCodeSend(email))) {
    return { ok: false, error: "Too many attempts. Try again in 5 minutes." };
  }

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

  if (await isCodeEntryLocked(email)) {
    return { ok: false, error: "Too many failed attempts. Try again in 15 minutes." };
  }

  if (!(await verifyOtp(email, code))) {
    await recordCodeFailure(email);
    return { ok: false, error: "Invalid or expired code. Try again." };
  }

  await recordCodeSuccess(email);

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
