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
import { db } from "@/lib/db";
import { deleteAccount, ownedSharedBuckets, type SharedBucket } from "@/lib/account/delete";

function sharedBucketsError(shared: SharedBucket[]): string {
  const names = shared.map((bucket) => bucket.name).join(", ");
  return `You own shared buckets (${names}). Delete them or remove their members first.`;
}

export async function getDeletionBlockersAction(): Promise<
  ActionResult<{ buckets: SharedBucket[] }>
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  return { ok: true, buckets: ownedSharedBuckets(db, session.userId) };
}

export async function sendAccountDeletionCodeAction(): Promise<ActionResult<{ devCode?: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const shared = ownedSharedBuckets(db, session.userId);
  if (shared.length > 0) return { ok: false, error: sharedBucketsError(shared) };
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
  const shared = ownedSharedBuckets(db, session.userId);
  if (shared.length > 0) return { ok: false, error: sharedBucketsError(shared) };
  if (await isCodeEntryLocked(session.email)) {
    return { ok: false, error: "Too many wrong codes. Try again in 15 minutes." };
  }
  if (!(await verifyOtp(session.email, code.trim()))) {
    await recordCodeFailure(session.email);
    return { ok: false, error: "Wrong or expired code." };
  }
  await recordCodeSuccess(session.email);

  const stillShared = deleteAccount(session.userId, session.email);
  if (stillShared.length > 0) return { ok: false, error: sharedBucketsError(stillShared) };
  await deleteSession();
  redirect("/login");
}
