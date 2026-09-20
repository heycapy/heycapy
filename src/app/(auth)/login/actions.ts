"use server";

import { Resend } from "resend";
import { createOtp, verifyOtp } from "@/lib/auth/otp";
import { createSession } from "@/lib/auth/session";
import { APP_NAME, APP_EMAIL_FROM } from "@/constants";
import { OTP_TTL_MINUTES } from "@/lib/auth/constants";
import { db } from "@/lib/db";
import { users, userSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { seed } from "@/lib/db/seed";

type SendOtpResult = { ok: true; devCode?: string } | { ok: false; error: string };
type VerifyOtpResult = { ok: true } | { ok: false; error: string };

export async function sendOtpAction(email: string): Promise<SendOtpResult> {
  const isDev = !process.env.RESEND_API_KEY;

  // in prod, only the configured email can log in
  if (!isDev) {
    const configuredEmail = process.env.EMAIL;
    if (!configuredEmail || email !== configuredEmail) {
      return { ok: true };
    }
  }

  try {
    const code = await createOtp(email);

    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[heycapy] OTP for ${email}: ${code}`);
      return { ok: true, devCode: code };
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: APP_EMAIL_FROM,
      to: email,
      subject: `Your ${APP_NAME} login code: ${code}`,
      text: `Your login code is: ${code}\n\nIt expires in ${OTP_TTL_MINUTES} minutes.`,
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to send code. Try again." };
  }
}

export async function verifyOtpAction(email: string, code: string): Promise<VerifyOtpResult> {
  const valid = await verifyOtp(email, code);
  if (!valid) return { ok: false, error: "Invalid or expired code. Try again." };

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
