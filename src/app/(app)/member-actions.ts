"use server";

import type { ActionResult } from "@/types/result";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "./action-helpers";
import { publicAppUrl } from "@/lib/app-url";
import { dataEvents } from "@/lib/events";
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
  is_owner: "The owner can't be removed or leave. Delete the bucket instead.",
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

  const result = redeemInvite(session.userId, parsed.data);
  if (!result.ok) return { ok: false, error: JOIN_ERRORS[result.reason] };

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

export async function removeMemberAction(
  bucketId: number,
  memberId: number
): Promise<ActionResult> {
  const session = await requireSession();
  const result = memberChange(removeMember(session.userId, bucketId, memberId));
  if (result.ok) {
    dataEvents.emit("refresh", memberId);
    revalidatePath("/");
  }
  return result;
}

export async function leaveBucketAction(bucketId: number): Promise<ActionResult> {
  const session = await requireSession();
  const result = memberChange(leaveBucket(session.userId, bucketId));
  if (result.ok) {
    dataEvents.emit("refresh", session.userId);
    revalidatePath("/");
  }
  return result;
}
