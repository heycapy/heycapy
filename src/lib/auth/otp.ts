import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { otps } from "@/lib/db/schema";
import { and, eq, gt, isNull } from "drizzle-orm";
import { OTP_LENGTH, OTP_TTL_MINUTES } from "./constants";
import { isE2ETestMode } from "@/lib/e2e";

export function generateOtp(): string {
  const min = Math.pow(10, OTP_LENGTH - 1);
  const max = Math.pow(10, OTP_LENGTH);
  return String(randomInt(min, max));
}

export async function createOtp(email: string): Promise<string> {
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await db.insert(otps).values({ email, code, expiresAt });
  return code;
}

export async function verifyOtp(email: string, code: string): Promise<boolean> {
  const now = new Date();

  const otp = await db.query.otps.findFirst({
    where: and(
      eq(otps.email, email),
      eq(otps.code, code),
      gt(otps.expiresAt, now),
      isNull(otps.usedAt)
    ),
  });

  if (!otp) return false;

  await db.update(otps).set({ usedAt: now }).where(eq(otps.id, otp.id));
  return true;
}

export function codesShownOnScreen(): boolean {
  return (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) || isE2ETestMode();
}
