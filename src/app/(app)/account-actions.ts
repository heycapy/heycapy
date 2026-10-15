"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
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
import { users } from "@/lib/db/schema";
import { AVATAR_PATTERN, toAvatar } from "@/lib/account/avatar";
import { deleteAccount, ownedSharedBuckets, type SharedBucket } from "@/lib/account/delete";
import { memberBucketIds } from "@/lib/buckets/access";
import { refreshBucketReminders } from "@/lib/reminders/refresh";

const AvatarInput = z.string().regex(AVATAR_PATTERN).nullable();

export async function getAvatarAction(): Promise<ActionResult<{ avatar: string | null }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const user = await db.query.users.findFirst({
    columns: { avatar: true },
    where: eq(users.id, session.userId),
  });
  return { ok: true, avatar: user?.avatar ?? null };
}

export async function saveAvatarAction(
  avatar: string | null
): Promise<ActionResult<{ avatar: string | null }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };
  const parsed = AvatarInput.safeParse(avatar);
  if (!parsed.success) return { ok: false, error: "That drawing can't be saved." };

  const saved = parsed.data === null ? null : toAvatar([...parsed.data]);
  await db.update(users).set({ avatar: saved }).where(eq(users.id, session.userId));
  revalidatePath("/", "layout");
  return { ok: true, avatar: saved };
}

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

  const joined = await memberBucketIds(session.userId);
  const stillShared = deleteAccount(session.userId, session.email);
  if (stillShared.length > 0) return { ok: false, error: sharedBucketsError(stillShared) };

  for (const { id } of joined) await refreshBucketReminders(id);
  await deleteSession();
  redirect("/login");
}
