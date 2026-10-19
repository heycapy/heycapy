"use server";

import type { ActionResult } from "@/types/result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "./action-helpers";
import { publicAppUrl } from "@/lib/app-url";
import { dataEvents } from "@/lib/events";
import { refreshBucketReminders } from "@/lib/reminders/refresh";
import { defaultChannels, getNotificationDefaults } from "@/lib/notifications/defaults";
import {
  deadlineHints,
  type DeadlineDraft,
  type DeadlineHint,
} from "@/lib/reminders/deadline-hints";
import { isKnownTimezone } from "@/lib/timezones/valid";
import {
  createInvite,
  listOpenInvites,
  redeemInvite,
  revokeInvite,
  type PendingInvite,
} from "@/lib/buckets/invites";
import {
  leaveBucket,
  listMembers,
  removeMember,
  transferOwnership,
  type BucketMember,
  type MemberChangeResult,
} from "@/lib/buckets/members";

const InviteCode = z.string().max(64);

const JOIN_ERRORS = {
  locked: "Too many wrong codes. Try again in 15 minutes.",
  invalid: "That code isn't valid or has expired.",
  full: "That bucket is full.",
} as const;

const MEMBER_ERRORS = {
  not_found: "That person isn't in this bucket.",
  not_owner: "Only the owner can do that.",
  is_owner: "The owner can't be removed or leave. Make someone else the owner first.",
  name_taken: "They already have a bucket with this name. Rename this one first.",
} as const;

function memberChange(result: MemberChangeResult): ActionResult {
  return result.ok ? { ok: true } : { ok: false, error: MEMBER_ERRORS[result.reason] };
}

export async function joinBucketAction(
  code: string
): Promise<ActionResult<{ bucketId: number; bucketName: string; alreadyMember: boolean }>> {
  const session = await requireSession();
  const parsed = InviteCode.safeParse(code);
  if (!parsed.success) return { ok: false, error: JOIN_ERRORS.invalid };

  const channels = await defaultChannels(
    session.userId,
    await getNotificationDefaults(session.userId)
  );
  const result = redeemInvite(session.userId, parsed.data, channels);
  if (!result.ok) return { ok: false, error: JOIN_ERRORS[result.reason] };

  if (!result.alreadyMember) await refreshBucketReminders(result.bucketId);
  dataEvents.emit("refresh", session.userId);
  revalidatePath("/");
  return {
    ok: true,
    bucketId: result.bucketId,
    bucketName: result.bucketName,
    alreadyMember: result.alreadyMember,
  };
}

export async function createInviteAction(
  bucketId: number
): Promise<ActionResult<{ code: string; expiresAt: Date; appUrl: string | null }>> {
  const session = await requireSession();
  const result = await createInvite(session.userId, bucketId);
  if (!result.ok) return result;
  return { ok: true, code: result.code, expiresAt: result.expiresAt, appUrl: publicAppUrl() };
}

export async function revokeInviteAction(inviteId: number): Promise<ActionResult> {
  const session = await requireSession();
  if (!(await revokeInvite(session.userId, inviteId))) {
    return { ok: false, error: "That invite is already used or gone." };
  }
  return { ok: true };
}

export async function listInvitesAction(
  bucketId: number
): Promise<ActionResult<{ invites: PendingInvite[] }>> {
  const session = await requireSession();
  return { ok: true, invites: await listOpenInvites(session.userId, bucketId) };
}

export async function listMembersAction(
  bucketId: number
): Promise<ActionResult<{ members: BucketMember[] }>> {
  const session = await requireSession();
  const members = await listMembers(session.userId, bucketId);
  if (!members) return { ok: false, error: "Bucket not found" };
  return { ok: true, members };
}

const DeadlineDraftSchema = z.object({
  deadline: z.string().nullable(),
  clock: z.string().nullable(),
  assigneeId: z.number().int().nullable(),
  reminderOffsets: z.array(z.number().int()).nullable(),
});

export async function deadlineHintsAction(
  bucketId: number,
  draft: DeadlineDraft
): Promise<ActionResult<{ hints: DeadlineHint[] }>> {
  const session = await requireSession();
  const parsed = DeadlineDraftSchema.safeParse(draft);
  if (!parsed.success) return { ok: false, error: "Invalid deadline" };
  if (parsed.data.clock && !isKnownTimezone(parsed.data.clock)) {
    return { ok: false, error: "That timezone doesn't exist" };
  }
  const hints = await deadlineHints(session.userId, bucketId, parsed.data);
  if (!hints) return { ok: false, error: "Bucket not found" };
  return { ok: true, hints };
}

export async function removeMemberAction(
  bucketId: number,
  memberId: number
): Promise<ActionResult> {
  const session = await requireSession();
  const result = memberChange(removeMember(session.userId, bucketId, memberId));
  if (result.ok) {
    await refreshBucketReminders(bucketId);
    dataEvents.emit("refresh", memberId);
    revalidatePath("/");
  }
  return result;
}

export async function leaveBucketAction(bucketId: number): Promise<ActionResult> {
  const session = await requireSession();
  const result = memberChange(leaveBucket(session.userId, bucketId));
  if (result.ok) {
    await refreshBucketReminders(bucketId);
    dataEvents.emit("refresh", session.userId);
    revalidatePath("/");
  }
  return result;
}

export async function transferOwnershipAction(
  bucketId: number,
  newOwnerId: number
): Promise<ActionResult> {
  const session = await requireSession();
  const result = memberChange(transferOwnership(session.userId, bucketId, newOwnerId));
  if (result.ok) {
    await refreshBucketReminders(bucketId);
    dataEvents.emit("refresh", newOwnerId);
    revalidatePath("/");
  }
  return result;
}
