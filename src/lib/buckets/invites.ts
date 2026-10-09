import { createHash, randomInt } from "node:crypto";
import { and, count, eq, gt, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketInvites, bucketMembers, buckets, inviteAttempts } from "@/lib/db/schema";
import { inLiveBucket } from "@/lib/buckets/live";
import {
  BUCKET_MEMBERS_MAX,
  INVITE_ACTIVE_MAX,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_FAIL_MAX,
  INVITE_LOCKOUT_MS,
  INVITE_TTL_MS,
} from "./constants";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type CreateInviteResult =
  { ok: true; code: string; expiresAt: Date } | { ok: false; error: string };

export type RedeemInviteResult =
  | { ok: true; bucketId: number; bucketName: string; alreadyMember: boolean }
  | { ok: false; reason: "locked" | "invalid" | "full" };

export type PendingInvite = { id: number; createdAt: Date; expiresAt: Date };

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

// Typed or pasted with spaces, dashes or lowercase, all the same code
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generateInviteCode(): string {
  return Array.from(
    { length: INVITE_CODE_LENGTH },
    () => INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)]
  ).join("");
}

function ownedBucketIds(userId: number) {
  return db.select({ id: buckets.id }).from(buckets).where(eq(buckets.userId, userId));
}

function openInvites(bucketId: number, now: Date) {
  return and(
    eq(bucketInvites.bucketId, bucketId),
    isNull(bucketInvites.usedAt),
    isNull(bucketInvites.revokedAt),
    gt(bucketInvites.expiresAt, now)
  );
}

export async function createInvite(
  ownerId: number,
  bucketId: number,
  now = new Date()
): Promise<CreateInviteResult> {
  const bucket = await db.query.buckets.findFirst({
    columns: { id: true },
    where: and(eq(buckets.id, bucketId), eq(buckets.userId, ownerId), inLiveBucket),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const [open] = await db
    .select({ n: count() })
    .from(bucketInvites)
    .where(openInvites(bucketId, now));
  if (open.n >= INVITE_ACTIVE_MAX) {
    return { ok: false, error: "Too many open invites, cancel one first" };
  }

  const code = generateInviteCode();
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);
  await db
    .insert(bucketInvites)
    .values({ bucketId, createdBy: ownerId, codeHash: hashCode(code), expiresAt });
  return { ok: true, code, expiresAt };
}

export async function revokeInvite(
  ownerId: number,
  inviteId: number,
  now = new Date()
): Promise<boolean> {
  const revoked = await db
    .update(bucketInvites)
    .set({ revokedAt: now })
    .where(
      and(
        eq(bucketInvites.id, inviteId),
        inArray(bucketInvites.bucketId, ownedBucketIds(ownerId)),
        isNull(bucketInvites.usedAt),
        isNull(bucketInvites.revokedAt)
      )
    )
    .returning({ id: bucketInvites.id });
  return revoked.length > 0;
}

export async function listOpenInvites(
  ownerId: number,
  bucketId: number,
  now = new Date()
): Promise<PendingInvite[]> {
  return db
    .select({
      id: bucketInvites.id,
      createdAt: bucketInvites.createdAt,
      expiresAt: bucketInvites.expiresAt,
    })
    .from(bucketInvites)
    .where(
      and(openInvites(bucketId, now), inArray(bucketInvites.bucketId, ownedBucketIds(ownerId)))
    )
    .orderBy(bucketInvites.createdAt);
}

function recordFailure(tx: Tx, userId: number, now: Date): void {
  const row = tx.select().from(inviteAttempts).where(eq(inviteAttempts.userId, userId)).get();
  const failCount = (row?.failCount ?? 0) + 1;
  const locked = failCount >= INVITE_FAIL_MAX;
  const state = {
    failCount: locked ? 0 : failCount,
    lockedUntil: locked ? new Date(now.getTime() + INVITE_LOCKOUT_MS) : null,
  };
  tx.insert(inviteAttempts)
    .values({ userId, ...state })
    .onConflictDoUpdate({ target: inviteAttempts.userId, set: state })
    .run();
}

// One generic failure for a wrong, used, revoked or expired code, so a guess learns nothing
export function redeemInvite(
  userId: number,
  rawCode: string,
  now = new Date()
): RedeemInviteResult {
  return db.transaction((tx) => {
    const attempts = tx
      .select()
      .from(inviteAttempts)
      .where(eq(inviteAttempts.userId, userId))
      .get();
    if (attempts?.lockedUntil && attempts.lockedUntil > now) return { ok: false, reason: "locked" };

    const invite = tx
      .select({
        id: bucketInvites.id,
        bucketId: bucketInvites.bucketId,
        bucketName: buckets.name,
      })
      .from(bucketInvites)
      .innerJoin(buckets, eq(buckets.id, bucketInvites.bucketId))
      .where(
        and(
          eq(bucketInvites.codeHash, hashCode(normalizeInviteCode(rawCode))),
          isNull(bucketInvites.usedAt),
          isNull(bucketInvites.revokedAt),
          gt(bucketInvites.expiresAt, now),
          inLiveBucket
        )
      )
      .get();
    if (!invite) {
      recordFailure(tx, userId, now);
      return { ok: false, reason: "invalid" };
    }

    const { bucketId, bucketName } = invite;
    const member = tx
      .select({ id: bucketMembers.id })
      .from(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)))
      .get();
    if (member) return { ok: true, bucketId, bucketName, alreadyMember: true };

    const size = tx
      .select({ n: count() })
      .from(bucketMembers)
      .where(eq(bucketMembers.bucketId, bucketId))
      .get();
    if ((size?.n ?? 0) >= BUCKET_MEMBERS_MAX) return { ok: false, reason: "full" };

    tx.insert(bucketMembers).values({ bucketId, userId }).run();
    tx.update(bucketInvites)
      .set({ usedAt: now, usedBy: userId })
      .where(eq(bucketInvites.id, invite.id))
      .run();
    tx.update(inviteAttempts)
      .set({ failCount: 0, lockedUntil: null })
      .where(eq(inviteAttempts.userId, userId))
      .run();
    return { ok: true, bucketId, bucketName, alreadyMember: false };
  });
}
