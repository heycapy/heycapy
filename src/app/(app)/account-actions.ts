"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/types/result";
import { deleteSession, getSession } from "@/lib/auth/session";
import { codesShownOnScreen, createOtp, verifyOtp } from "@/lib/auth/otp";
import { buildOtpEmail } from "@/lib/auth/otpEmail";
import {
  allowCodeSend,
  isCodeEntryLocked,
  recordCodeFailure,
  recordCodeSuccess,
} from "@/lib/auth/rate-limit";
import { sendEmail } from "@/lib/notifications/email";
import { deleteAccount } from "@/lib/account/delete";

export async function sendAccountDeletionCodeAction(): Promise<ActionResult<{ devCode?: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  if (!(await allowCodeSend(session.email))) {
    return { ok: false, error: "Too many codes sent. Try again in 5 minutes." };
  }

  const code = await createOtp(session.email);
  if (codesShownOnScreen()) return { ok: true, devCode: code };
  try {
    await sendEmail({ to: session.email, ...(await buildOtpEmail(code, "delete-account")) });
  } catch {
    return { ok: false, error: "Couldn't send the code. Try again." };
  }
  return { ok: true };
}

// Needs a fresh code from the account's inbox, not just a logged-in browser
export async function deleteAccountAction(code: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  if (await isCodeEntryLocked(session.email)) {
    return { ok: false, error: "Too many wrong codes. Try again in 15 minutes." };
  }
  if (!(await verifyOtp(session.email, code.trim()))) {
    await recordCodeFailure(session.email);
    return { ok: false, error: "Wrong or expired code." };
  }
  await recordCodeSuccess(session.email);

  deleteAccount(session.userId, session.email);
  await deleteSession();
  redirect("/login");
}
