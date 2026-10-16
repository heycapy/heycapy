import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  bucketMembers,
  buckets,
  items,
  notificationQueue,
  users,
  userSettings,
} from "@/lib/db/schema";
import { UNSET_TIMEZONE } from "@/lib/timezones/constants";
import { placeName } from "@/lib/timezones/place";
import { channelDecisions, getChannelSettings } from "@/lib/notifications/channels";
import { memberChannels } from "@/lib/rules";
import { encryptValue, generateWebhookKey } from "@/lib/crypto";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type BucketMember = {
  userId: number;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  role: "owner" | "member";
  joinedAt: Date;
  isYou: boolean;
  timezone: string;
  place: string | null;
  remindable: boolean;
};

export type MemberChangeResult =
  { ok: true } | { ok: false; reason: "not_found" | "not_owner" | "is_owner" | "name_taken" };

// Never the email: members only know each other by name
export async function listMembers(
  viewerId: number,
  bucketId: number
): Promise<BucketMember[] | null> {
  const viewer = await db.query.bucketMembers.findFirst({
    columns: { id: true },
    where: and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, viewerId)),
  });
  if (!viewer) return null;

  const rows = await db
    .select({
      userId: users.id,
      username: users.username,
      displayName: users.displayName,
      avatar: users.avatar,
      role: bucketMembers.role,
      joinedAt: bucketMembers.createdAt,
      channels: bucketMembers.channels,
      timezone: userSettings.timezone,
    })
    .from(bucketMembers)
    .innerJoin(users, eq(users.id, bucketMembers.userId))
    .leftJoin(userSettings, eq(userSettings.userId, users.id))
    .where(eq(bucketMembers.bucketId, bucketId))
    .orderBy(
      sql`${bucketMembers.role} = 'owner' desc`,
      asc(bucketMembers.createdAt),
      asc(bucketMembers.id)
    );
  return Promise.all(
    rows.map(async ({ channels, ...row }) => {
      const timezone = row.timezone ?? UNSET_TIMEZONE;
      const remindable = channelDecisions(
        memberChannels(channels),
        await getChannelSettings(row.userId)
      ).some((c) => c.state === "send");
      return {
        ...row,
        timezone,
        place: placeName(timezone),
        remindable,
        isYou: row.userId === viewerId,
      };
    })
  );
}

// Reminders already queued for them would still arrive for a bucket they can no longer see.
// Their reminder schedules go when the caller refreshes the bucket, so whoever takes over an item
// assigned to them starts from what they were already sent.
function dropMember(tx: Tx, bucketId: number, userId: number): void {
  tx.delete(bucketMembers)
    .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)))
    .run();
  tx.update(items)
    .set({ assigneeId: null })
    .where(and(eq(items.bucketId, bucketId), eq(items.assigneeId, userId)))
    .run();
  tx.update(notificationQueue)
    .set({ status: "cancelled", lastError: "no longer a member of the bucket" })
    .where(
      and(
        eq(notificationQueue.userId, userId),
        inArray(notificationQueue.status, ["pending", "sending"]),
        inArray(
          notificationQueue.itemId,
          tx.select({ id: items.id }).from(items).where(eq(items.bucketId, bucketId))
        )
      )
    )
    .run();
}

export function removeMember(
  ownerId: number,
  bucketId: number,
  memberId: number
): MemberChangeResult {
  return db.transaction((tx) => {
    const bucket = tx
      .select({ userId: buckets.userId })
      .from(buckets)
      .where(eq(buckets.id, bucketId))
      .get();
    if (!bucket || bucket.userId !== ownerId) return { ok: false, reason: "not_owner" };
    if (memberId === ownerId) return { ok: false, reason: "is_owner" };
    const member = tx
      .select({ id: bucketMembers.id })
      .from(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, memberId)))
      .get();
    if (!member) return { ok: false, reason: "not_found" };

    dropMember(tx, bucketId, memberId);
    return { ok: true };
  });
}

export function leaveBucket(userId: number, bucketId: number): MemberChangeResult {
  return db.transaction((tx) => {
    const member = tx
      .select({ role: bucketMembers.role })
      .from(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, userId)))
      .get();
    if (!member) return { ok: false, reason: "not_found" };
    if (member.role === "owner") return { ok: false, reason: "is_owner" };

    dropMember(tx, bucketId, userId);
    return { ok: true };
  });
}

function telegramAlias(raw: string | null): string | null {
  try {
    const alias = raw ? (JSON.parse(raw) as { alias?: unknown }).alias : null;
    return typeof alias === "string" ? alias : null;
  } catch {
    return null;
  }
}

// The old owner stays a member. What only the owner held moves with the bucket, except the incoming
// webhook key, which the old owner still knows, and a Telegram alias the new owner already uses.
// Everyone's own channels stay theirs.
export function transferOwnership(
  ownerId: number,
  bucketId: number,
  newOwnerId: number
): MemberChangeResult {
  return db.transaction((tx) => {
    const bucket = tx
      .select({
        userId: buckets.userId,
        name: buckets.name,
        webhookKey: buckets.webhookKey,
        telegramConfig: buckets.telegramConfig,
      })
      .from(buckets)
      .where(and(eq(buckets.id, bucketId), isNull(buckets.deletedAt)))
      .get();
    if (!bucket || bucket.userId !== ownerId) return { ok: false, reason: "not_owner" };
    if (newOwnerId === ownerId) return { ok: false, reason: "is_owner" };
    const member = tx
      .select({ id: bucketMembers.id })
      .from(bucketMembers)
      .where(and(eq(bucketMembers.bucketId, bucketId), eq(bucketMembers.userId, newOwnerId)))
      .get();
    if (!member) return { ok: false, reason: "not_found" };

    const theirs = tx
      .select({ name: buckets.name, telegramConfig: buckets.telegramConfig })
      .from(buckets)
      .where(and(eq(buckets.userId, newOwnerId), isNull(buckets.deletedAt)))
      .all();
    const sameName = (name: string) => name.toLowerCase() === bucket.name.toLowerCase();
    if (theirs.some((b) => sameName(b.name))) return { ok: false, reason: "name_taken" };

    const alias = telegramAlias(bucket.telegramConfig);
    const aliasTaken =
      alias !== null && theirs.some((b) => telegramAlias(b.telegramConfig) === alias);
    const telegramConfig =
      aliasTaken && bucket.telegramConfig
        ? JSON.stringify({ ...(JSON.parse(bucket.telegramConfig) as object), alias: null })
        : bucket.telegramConfig;

    tx.update(buckets)
      .set({
        userId: newOwnerId,
        webhookKey: bucket.webhookKey ? encryptValue(generateWebhookKey()) : null,
        telegramConfig,
        updatedAt: new Date(),
      })
      .where(eq(buckets.id, bucketId))
      .run();
    tx.update(bucketMembers)
      .set({
        role: sql`case when ${bucketMembers.userId} = ${newOwnerId} then 'owner' else 'member' end`,
      })
      .where(eq(bucketMembers.bucketId, bucketId))
      .run();
    return { ok: true };
  });
}
