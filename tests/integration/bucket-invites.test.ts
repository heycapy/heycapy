import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketInvites, bucketMembers, buckets } from "@/lib/db/schema";
import { createInvite, listOpenInvites, redeemInvite, revokeInvite } from "@/lib/buckets/invites";
import { normalizeInviteCode } from "@/lib/buckets/invite-code";
import {
  BUCKET_MEMBERS_MAX,
  INVITE_ACTIVE_MAX,
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_FAIL_MAX,
  INVITE_LOCKOUT_MS,
  INVITE_TTL_MS,
} from "@/lib/buckets/constants";
import { HOUR, MINUTE, seedBucket, seedUser } from "./helpers";

const NOW = new Date("2026-03-10T12:00:00Z");

async function invite(ownerId: number, bucketId: number, now = NOW): Promise<string> {
  const result = await createInvite(ownerId, bucketId, now);
  if (!result.ok) throw new Error(result.error);
  return result.code;
}

async function memberIds(bucketId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: bucketMembers.userId })
    .from(bucketMembers)
    .where(eq(bucketMembers.bucketId, bucketId));
  return rows.map((r) => r.userId).sort((a, b) => a - b);
}

describe("creating an invite", () => {
  it("gives a short code made only of the safe characters and keeps just its hash", async () => {
    const owner = await seedUser();
    const bucketId = await seedBucket(owner);

    const result = await createInvite(owner, bucketId, NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.code).toHaveLength(INVITE_CODE_LENGTH);
    for (const char of result.code) expect(INVITE_CODE_ALPHABET).toContain(char);
    expect(result.expiresAt.getTime()).toBe(NOW.getTime() + INVITE_TTL_MS);
    const [row] = await db.select().from(bucketInvites).where(eq(bucketInvites.bucketId, bucketId));
    expect(JSON.stringify(row)).not.toContain(result.code);
  });

  it("is for the owner only", async () => {
    const owner = await seedUser();
    const member = await seedUser();
    const stranger = await seedUser();
    const bucketId = await seedBucket(owner);
    await db.insert(bucketMembers).values({ bucketId, userId: member });

    expect(await createInvite(member, bucketId, NOW)).toMatchObject({ ok: false });
    expect(await createInvite(stranger, bucketId, NOW)).toMatchObject({ ok: false });
  });

  it("is refused for a deleted bucket", async () => {
    const owner = await seedUser();
    const bucketId = await seedBucket(owner);
    await db.update(buckets).set({ deletedAt: NOW }).where(eq(buckets.id, bucketId));

    expect(await createInvite(owner, bucketId, NOW)).toMatchObject({ ok: false });
  });

  it("stops at the open invite limit and frees a place when one is used or revoked", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    const codes: string[] = [];
    for (let i = 0; i < INVITE_ACTIVE_MAX; i++) codes.push(await invite(owner, bucketId));

    expect(await createInvite(owner, bucketId, NOW)).toMatchObject({ ok: false });

    expect(redeemInvite(friend, codes[0], NOW)).toMatchObject({ ok: true });
    expect(await createInvite(owner, bucketId, NOW)).toMatchObject({ ok: true });
    expect(await createInvite(owner, bucketId, NOW)).toMatchObject({ ok: false });
  });
});

describe("joining with a code", () => {
  it("makes the person a member, and the code works once", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const other = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await invite(owner, bucketId);

    expect(redeemInvite(friend, code, NOW)).toMatchObject({
      ok: true,
      bucketId,
      alreadyMember: false,
    });
    expect(await memberIds(bucketId)).toEqual([owner, friend].sort((a, b) => a - b));
    expect(redeemInvite(other, code, NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(await memberIds(bucketId)).not.toContain(other);
  });

  it("accepts the code typed with spaces, dashes or lowercase", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await invite(owner, bucketId);
    const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();

    expect(normalizeInviteCode(typed)).toBe(code);
    expect(redeemInvite(friend, ` ${typed} `, NOW)).toMatchObject({ ok: true });
  });

  it("does not accept an expired, revoked or unknown code, all with the same answer", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    const expired = await invite(owner, bucketId);
    const revoked = await invite(owner, bucketId);
    const [revokedRow] = await listOpenInvites(owner, bucketId, NOW).then((rows) => rows.slice(-1));
    await revokeInvite(owner, revokedRow.id, NOW);
    const later = new Date(NOW.getTime() + INVITE_TTL_MS + MINUTE);

    expect(redeemInvite(friend, expired, later)).toEqual({ ok: false, reason: "invalid" });
    expect(redeemInvite(friend, revoked, NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(redeemInvite(friend, "ABCD2345", NOW)).toEqual({ ok: false, reason: "invalid" });
    expect(await memberIds(bucketId)).toEqual([owner]);
  });

  it("does not accept a code for a deleted or archived bucket", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const deletedBucket = await seedBucket(owner);
    const archivedBucket = await seedBucket(owner);
    const deletedCode = await invite(owner, deletedBucket);
    const archivedCode = await invite(owner, archivedBucket);
    await db.update(buckets).set({ deletedAt: NOW }).where(eq(buckets.id, deletedBucket));
    await db.update(buckets).set({ archivedAt: NOW }).where(eq(buckets.id, archivedBucket));

    expect(redeemInvite(friend, deletedCode, NOW)).toMatchObject({ ok: false });
    expect(redeemInvite(friend, archivedCode, NOW)).toMatchObject({ ok: false });
  });

  it("leaves the code unused when the person is already a member", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await invite(owner, bucketId);

    expect(redeemInvite(owner, code, NOW)).toMatchObject({ ok: true, alreadyMember: true });
    expect(redeemInvite(friend, code, NOW)).toMatchObject({ ok: true, alreadyMember: false });
  });

  it("refuses a full bucket and keeps the code for later", async () => {
    const owner = await seedUser();
    const bucketId = await seedBucket(owner);
    for (let i = 1; i < BUCKET_MEMBERS_MAX; i++) {
      await db.insert(bucketMembers).values({ bucketId, userId: await seedUser() });
    }
    const late = await seedUser();
    const code = await invite(owner, bucketId);

    expect(redeemInvite(late, code, NOW)).toEqual({ ok: false, reason: "full" });

    const [leaver] = await db
      .select()
      .from(bucketMembers)
      .where(eq(bucketMembers.bucketId, bucketId))
      .limit(1)
      .offset(1);
    await db.delete(bucketMembers).where(eq(bucketMembers.id, leaver.id));
    expect(redeemInvite(late, code, NOW)).toMatchObject({ ok: true });
  });
});

describe("guessing codes", () => {
  it("locks the person out after too many wrong codes, even for a right one, until it passes", async () => {
    const owner = await seedUser();
    const guesser = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await invite(owner, bucketId);
    for (let i = 0; i < INVITE_FAIL_MAX; i++) {
      expect(redeemInvite(guesser, "ABCD2345", NOW)).toEqual({ ok: false, reason: "invalid" });
    }

    expect(redeemInvite(guesser, code, NOW)).toEqual({ ok: false, reason: "locked" });
    const after = new Date(NOW.getTime() + INVITE_LOCKOUT_MS + MINUTE);
    expect(redeemInvite(guesser, code, after)).toMatchObject({ ok: true });
  });

  it("starts counting again after a right code", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    for (let i = 0; i < INVITE_FAIL_MAX - 1; i++) redeemInvite(friend, "ABCD2345", NOW);
    expect(redeemInvite(friend, await invite(owner, bucketId), NOW)).toMatchObject({ ok: true });

    const second = await seedBucket(owner);
    const secondCode = await invite(owner, second);
    for (let i = 0; i < INVITE_FAIL_MAX - 1; i++) redeemInvite(friend, "ABCD2345", NOW);
    expect(redeemInvite(friend, secondCode, NOW)).toMatchObject({ ok: true });
  });

  it("counts each person on their own", async () => {
    const owner = await seedUser();
    const guesser = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await invite(owner, bucketId);
    for (let i = 0; i < INVITE_FAIL_MAX; i++) redeemInvite(guesser, "ABCD2345", NOW);

    expect(redeemInvite(friend, code, NOW)).toMatchObject({ ok: true });
  });
});

describe("open invites", () => {
  it("lists only the ones that can still be used, for the owner", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const stranger = await seedUser();
    const bucketId = await seedBucket(owner);
    const used = await invite(owner, bucketId);
    await invite(owner, bucketId);
    await invite(owner, bucketId, new Date(NOW.getTime() - INVITE_TTL_MS - HOUR));
    redeemInvite(friend, used, NOW);

    expect(await listOpenInvites(owner, bucketId, NOW)).toHaveLength(1);
    expect(await listOpenInvites(stranger, bucketId, NOW)).toEqual([]);
  });

  it("can be cancelled by the owner only, and only while unused", async () => {
    const owner = await seedUser();
    const stranger = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await invite(owner, bucketId);
    const [open] = await listOpenInvites(owner, bucketId, NOW);

    expect(await revokeInvite(stranger, open.id, NOW)).toBe(false);
    expect(await revokeInvite(owner, open.id, NOW)).toBe(true);
    expect(await revokeInvite(owner, open.id, NOW)).toBe(false);
    expect(redeemInvite(stranger, code, NOW)).toEqual({ ok: false, reason: "invalid" });
  });
});
