import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, buckets, type templates } from "@/lib/db/schema";
import { encryptValue, generateWebhookKey } from "@/lib/crypto";
import { defaultValues, followedRules } from "@/lib/buckets/follow";
import {
  defaultChannels,
  getNotificationDefaults,
  parseObject,
} from "@/lib/notifications/defaults";
import { FOLLOWABLE_SETTINGS, type BucketSchema, type FollowableSetting } from "@/types/rules";

type NewBucket = Omit<typeof buckets.$inferInsert, "notificationsRules">;

// Case-insensitive, so "Todo" and "todo" count as the same name
export async function findBucketByName(
  userId: number,
  name: string,
  excludeId?: number
): Promise<{ id: number } | null> {
  const [row] = await db
    .select({ id: buckets.id })
    .from(buckets)
    .where(
      and(
        eq(buckets.userId, userId),
        isNull(buckets.deletedAt),
        sql`lower(${buckets.name}) = lower(${name})`,
        excludeId !== undefined ? ne(buckets.id, excludeId) : undefined
      )
    )
    .limit(1);
  return row ?? null;
}

// What a template sets is the bucket's own, everything else follows the owner's tweaks. Channels
// always come from tweaks, a template can't know which ones someone has set up
function ownSettings(
  notifications: Record<string, unknown>,
  fieldSchema: Record<string, unknown>
): FollowableSetting[] {
  return FOLLOWABLE_SETTINGS.filter((key) =>
    key === "overdue" ? "notifyWhenOverdue" in fieldSchema : key in notifications
  );
}

// null when the template's rules aren't valid JSON
export async function createBucketFromTemplate(
  userId: number,
  template: typeof templates.$inferSelect,
  name: string,
  createdAt?: Date
): Promise<number | null> {
  let rules: Record<string, unknown>;
  try {
    rules = JSON.parse(template.rulesJson) as Record<string, unknown>;
  } catch {
    return null;
  }

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${buckets.sortOrder}), -1)` })
    .from(buckets)
    .where(eq(buckets.userId, userId));

  return createBucket(
    {
      userId,
      name,
      itemsRules: JSON.stringify(rules.items ?? {}),
      mcpRules: rules.mcp ? JSON.stringify(rules.mcp) : null,
      personalityRules: JSON.stringify(rules.personality ?? {}),
      fieldSchema: (template.fieldSchemaJson ?? null) as unknown as BucketSchema,
      webhookKey: encryptValue(generateWebhookKey()),
      sortOrder: maxRow.max + 1,
      ...(createdAt && { createdAt, updatedAt: createdAt }),
    },
    rules.notifications
  );
}

export async function createBucket(values: NewBucket, notifications: unknown): Promise<number> {
  const defaults = await getNotificationDefaults(values.userId);
  const channels = await defaultChannels(values.userId, defaults);
  const template = parseObject(notifications);
  delete template.medium;
  delete template.webhooks;
  const fieldSchema = parseObject(values.fieldSchema);
  const own = ownSettings(template, fieldSchema);
  const follows = FOLLOWABLE_SETTINGS.filter((key) => !own.includes(key));
  const followed = followedRules(follows, defaultValues(defaults));
  // capy keeps any item values in a bucket without a field schema, so "off" doesn't add one
  const keepNoSchema = !values.fieldSchema && !followed.overdue.notifyWhenOverdue;

  return db.transaction((tx) => {
    const bucket = tx
      .insert(buckets)
      .values({
        ...values,
        notificationsRules: JSON.stringify({
          ...template,
          ...followed.notifications,
          followsTweaks: follows,
        }),
        fieldSchema: keepNoSchema
          ? null
          : (JSON.stringify({ ...fieldSchema, ...followed.overdue }) as unknown as BucketSchema),
      })
      .returning({ id: buckets.id })
      .get();
    tx.update(bucketMembers)
      .set({ channels: JSON.stringify(channels) })
      .where(and(eq(bucketMembers.bucketId, bucket.id), eq(bucketMembers.userId, values.userId)))
      .run();
    return bucket.id;
  });
}
