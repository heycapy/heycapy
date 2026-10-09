import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as SessionModule from "@/lib/auth/session";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers } from "@/lib/db/schema";
import { dataEvents } from "@/lib/events";
import {
  createInviteAction,
  joinBucketAction,
  leaveBucketAction,
  listInvitesAction,
  listMembersAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/app/(app)/member-actions";
import { INVITE_FAIL_MAX } from "@/lib/buckets/constants";
import { seedBucket, seedUser } from "./helpers";

const session = vi.hoisted(() => ({ userId: 0, email: "" }));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
  ...(await importOriginal<typeof SessionModule>()),
  getSession: async () => session,
}));

const refreshed: number[] = [];
const onRefresh = (userId: number) => refreshed.push(userId);
beforeEach(() => {
  refreshed.length = 0;
  dataEvents.on("refresh", onRefresh);
});
afterEach(() => {
  dataEvents.off("refresh", onRefresh);
});

async function inviteCode(owner: number, bucketId: number): Promise<string> {
  session.userId = owner;
  const result = await createInviteAction(bucketId);
  if (!result.ok) throw new Error(result.error);
  return result.code;
}

describe("inviting and joining", () => {
  it("lets the owner invite and a friend join, and tells the friend's open tabs", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await inviteCode(owner, bucketId);

    session.userId = friend;
    const joined = await joinBucketAction(code);

    expect(joined).toMatchObject({ ok: true, bucketId, alreadyMember: false });
    expect(refreshed).toContain(friend);
    const members = await listMembersAction(bucketId);
    expect(members.ok && members.members.map((m) => m.userId)).toEqual([owner, friend]);
  });

  it("gives a code and when it expires", async () => {
    const owner = await seedUser();
    const bucketId = await seedBucket(owner);
    session.userId = owner;

    const result = await createInviteAction(bucketId);

    expect(result).toMatchObject({ ok: true, code: expect.stringMatching(/^[A-Z2-9]{8}$/) });
    expect(result.ok && result.expiresAt).toBeInstanceOf(Date);
  });

  it("refuses an invite from someone who is not the owner", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await inviteCode(owner, bucketId);
    session.userId = friend;
    await joinBucketAction(code);

    expect(await createInviteAction(bucketId)).toMatchObject({ ok: false });
    expect(await listInvitesAction(bucketId)).toEqual({ ok: true, invites: [] });
  });

  it("answers a wrong code the same way every time, then locks out guessing", async () => {
    const owner = await seedUser();
    const guesser = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await inviteCode(owner, bucketId);
    session.userId = guesser;

    for (let i = 0; i < INVITE_FAIL_MAX; i++) {
      expect(await joinBucketAction("ABCD2345")).toEqual({
        ok: false,
        error: "That code isn't valid or has expired.",
      });
    }
    expect(await joinBucketAction(code)).toEqual({
      ok: false,
      error: "Too many wrong codes. Try again in 15 minutes.",
    });
  });

  it("does not run on an absurdly long code", async () => {
    session.userId = await seedUser();
    expect(await joinBucketAction("A".repeat(10_000))).toEqual({
      ok: false,
      error: "That code isn't valid or has expired.",
    });
  });

  it("lets the owner cancel an open invite, once", async () => {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await inviteCode(owner, bucketId);
    const listed = await listInvitesAction(bucketId);
    if (!listed.ok) throw new Error(listed.error);
    expect(listed.invites).toHaveLength(1);

    expect(await revokeInviteAction(listed.invites[0].id)).toEqual({ ok: true });
    expect(await revokeInviteAction(listed.invites[0].id)).toMatchObject({ ok: false });
    session.userId = friend;
    expect(await joinBucketAction(code)).toMatchObject({ ok: false });
  });
});

describe("members and leaving", () => {
  async function sharedBucket() {
    const owner = await seedUser();
    const friend = await seedUser();
    const bucketId = await seedBucket(owner);
    const code = await inviteCode(owner, bucketId);
    session.userId = friend;
    await joinBucketAction(code);
    return { owner, friend, bucketId };
  }

  async function memberIds(bucketId: number) {
    const rows = await db
      .select({ userId: bucketMembers.userId })
      .from(bucketMembers)
      .where(eq(bucketMembers.bucketId, bucketId));
    return rows.map((r) => r.userId);
  }

  it("shows the member list to members and to nobody else", async () => {
    const { bucketId } = await sharedBucket();

    expect((await listMembersAction(bucketId)).ok).toBe(true);
    session.userId = await seedUser();
    expect(await listMembersAction(bucketId)).toEqual({ ok: false, error: "Bucket not found" });
  });

  it("lets the owner remove a member and tells the removed person's tabs", async () => {
    const { owner, friend, bucketId } = await sharedBucket();
    refreshed.length = 0;
    session.userId = owner;

    expect(await removeMemberAction(bucketId, friend)).toEqual({ ok: true });

    expect(await memberIds(bucketId)).toEqual([owner]);
    expect(refreshed).toContain(friend);
  });

  it("does not let a member remove anyone, including the owner", async () => {
    const { owner, friend, bucketId } = await sharedBucket();
    session.userId = friend;

    expect(await removeMemberAction(bucketId, owner)).toEqual({
      ok: false,
      error: "Only the owner can do that.",
    });
    expect(await memberIds(bucketId)).toHaveLength(2);
  });

  it("lets a member leave but not the owner", async () => {
    const { owner, friend, bucketId } = await sharedBucket();

    session.userId = owner;
    expect(await leaveBucketAction(bucketId)).toMatchObject({ ok: false });
    session.userId = friend;
    expect(await leaveBucketAction(bucketId)).toEqual({ ok: true });
    expect(await memberIds(bucketId)).toEqual([owner]);
  });
});
