"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { requireSession } from "./action-helpers";
import { db } from "@/lib/db";
import { buckets, templates } from "@/lib/db/schema";
import { encryptValue, decryptValue, generateWebhookKey } from "@/lib/crypto";
import { BUCKET_NAME_MAX_LENGTH } from "@/constants";
import type {
  ItemsRulesConfig,
  NotificationsRulesConfig,
  TelegramBotConfig,
} from "@/components/buckets/constants";
import { BucketSchema } from "@/types/rules";
import { buildPropertyValidator } from "@/types/rules";

export async function createBucketAction(
  templateId: number,
  name: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  if (trimmed.length > BUCKET_NAME_MAX_LENGTH) return { ok: false, error: "Name too long" };

  const template = await db.query.templates.findFirst({
    where: (t, { eq: qeq }) => qeq(t.id, templateId),
  });
  if (!template) return { ok: false, error: "Template not found" };

  let rules: Record<string, unknown>;
  try {
    rules = JSON.parse(template.rulesJson) as Record<string, unknown>;
  } catch {
    return { ok: false, error: "Template data is corrupted." };
  }

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${buckets.sortOrder}), -1)` })
    .from(buckets)
    .where(eq(buckets.userId, session.userId));

  await db.insert(buckets).values({
    userId: session.userId,
    name: trimmed,
    notificationsRules: JSON.stringify(rules.notifications ?? {}),
    itemsRules: JSON.stringify(rules.items ?? {}),
    mcpRules: rules.mcp ? JSON.stringify(rules.mcp) : null,
    personalityRules: JSON.stringify(rules.personality ?? {}),
    fieldSchema: (template.fieldSchemaJson ?? null) as unknown as BucketSchema,
    webhookKey: encryptValue(generateWebhookKey()),
    sortOrder: maxRow.max + 1,
  });

  revalidatePath("/");
  return { ok: true };
}

type NotificationTriggers = {
  notifyOnArrival?: boolean;
  notifyWhenOverdue?: boolean;
  overdueRepeatHours?: number | undefined;
};

export async function updateBucketSettingsAction(
  bucketId: number,
  name: string,
  itemsRules: ItemsRulesConfig,
  notificationsRules: NotificationsRulesConfig,
  telegramConfig?: TelegramBotConfig | null,
  notificationTriggers?: NotificationTriggers
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  if (trimmed.length > BUCKET_NAME_MAX_LENGTH) return { ok: false, error: "Name too long" };

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  let updatedFieldSchema: unknown = bucket.fieldSchema;
  if (notificationTriggers !== undefined) {
    try {
      const existing = bucket.fieldSchema
        ? ((typeof bucket.fieldSchema === "string"
            ? JSON.parse(bucket.fieldSchema as string)
            : bucket.fieldSchema) as Record<string, unknown>)
        : {};
      updatedFieldSchema = {
        ...existing,
        notifyOnArrival: notificationTriggers.notifyOnArrival ?? false,
        notifyWhenOverdue: notificationTriggers.notifyWhenOverdue ?? false,
        overdueRepeatHours: notificationTriggers.notifyWhenOverdue
          ? notificationTriggers.overdueRepeatHours
          : undefined,
      };
    } catch (err) {
      process.stderr.write(
        `[bucket-actions] failed to parse fieldSchema for bucket ${bucketId}: ${err instanceof Error ? err.message : String(err)}\n`
      );
    }
  }

  await db
    .update(buckets)
    .set({
      name: trimmed,
      itemsRules: JSON.stringify(itemsRules),
      notificationsRules: JSON.stringify(notificationsRules),
      ...(telegramConfig !== undefined
        ? { telegramConfig: telegramConfig ? JSON.stringify(telegramConfig) : null }
        : {}),
      ...(notificationTriggers !== undefined
        ? { fieldSchema: JSON.stringify(updatedFieldSchema) as unknown as BucketSchema }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function updateBucketTelegramConfigAction(
  bucketId: number,
  config: TelegramBotConfig
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();
  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };
  await db
    .update(buckets)
    .set({ telegramConfig: JSON.stringify(config), updatedAt: new Date() })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));
  revalidatePath("/");
  return { ok: true };
}

export async function archiveBucketAction(
  bucketId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  await db
    .update(buckets)
    .set({ archivedAt: new Date() })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function restoreBucketAction(
  bucketId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  await db
    .update(buckets)
    .set({ archivedAt: null })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function deleteBucketAction(
  bucketId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  await db
    .update(buckets)
    .set({ deletedAt: new Date() })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function restoreDeletedBucketAction(
  bucketId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  await db
    .update(buckets)
    .set({ deletedAt: null })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function permanentlyDeleteBucketAction(
  bucketId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  await db.delete(buckets).where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function getDeletedBucketsAction(): Promise<
  { ok: true; buckets: (typeof buckets.$inferSelect)[] } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const result = await db
    .select()
    .from(buckets)
    .where(and(eq(buckets.userId, session.userId), isNotNull(buckets.deletedAt)))
    .orderBy(desc(buckets.deletedAt));

  return { ok: true, buckets: result };
}

export async function getArchivedBucketsAction(): Promise<
  { ok: true; buckets: (typeof buckets.$inferSelect)[] } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const result = await db
    .select()
    .from(buckets)
    .where(
      and(
        eq(buckets.userId, session.userId),
        isNotNull(buckets.archivedAt),
        isNull(buckets.deletedAt)
      )
    )
    .orderBy(desc(buckets.archivedAt));

  return { ok: true, buckets: result };
}

export async function updateBucketSchemaAction(
  bucketId: number,
  schema: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const parsed = BucketSchema.safeParse(schema);
  if (!parsed.success) return { ok: false, error: "Invalid schema" };

  try {
    buildPropertyValidator(parsed.data.fields);
  } catch {
    return { ok: false, error: "Invalid field definitions" };
  }

  let existing: Record<string, unknown> = {};
  try {
    if (bucket.fieldSchema) {
      existing =
        typeof bucket.fieldSchema === "string"
          ? (JSON.parse(bucket.fieldSchema as string) as Record<string, unknown>)
          : (bucket.fieldSchema as Record<string, unknown>);
    }
  } catch (err) {
    process.stderr.write(
      `[bucket-actions] failed to parse existing fieldSchema for bucket ${bucketId}: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }

  const merged = {
    ...parsed.data,
    ...(existing.notifyOnArrival !== undefined && { notifyOnArrival: existing.notifyOnArrival }),
    ...(existing.notifyWhenOverdue !== undefined && {
      notifyWhenOverdue: existing.notifyWhenOverdue,
    }),
    ...(existing.overdueRepeatHours !== undefined && {
      overdueRepeatHours: existing.overdueRepeatHours,
    }),
  };

  await db
    .update(buckets)
    .set({
      fieldSchema: JSON.stringify(merged) as unknown as BucketSchema,
      updatedAt: new Date(),
    })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function rotateWebhookKeyAction(
  bucketId: number
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const key = generateWebhookKey();
  await db
    .update(buckets)
    .set({ webhookKey: encryptValue(key), updatedAt: new Date() })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true, key };
}

export async function getWebhookKeyAction(
  bucketId: number
): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };
  if (!bucket.webhookKey) return { ok: false, error: "No webhook key set" };

  return { ok: true, key: decryptValue(bucket.webhookKey) };
}

export type CapyFile = {
  version: 1;
  name: string;
  notificationsRules: string;
  itemsRules: string;
  fieldSchema: string | null;
};

export async function exportBucketCapyAction(
  bucketId: number
): Promise<{ ok: true; data: CapyFile } | { ok: false; error: string }> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  return {
    ok: true,
    data: {
      version: 1,
      name: bucket.name,
      notificationsRules: bucket.notificationsRules,
      itemsRules: bucket.itemsRules,
      fieldSchema: bucket.fieldSchema ? JSON.stringify(bucket.fieldSchema) : null,
    },
  };
}

export async function importBucketFromCapyAction(
  data: CapyFile,
  name: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  if (trimmed.length > BUCKET_NAME_MAX_LENGTH) return { ok: false, error: "Name too long" };

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${buckets.sortOrder}), -1)` })
    .from(buckets)
    .where(eq(buckets.userId, session.userId));

  await db.insert(buckets).values({
    userId: session.userId,
    name: trimmed,
    notificationsRules: data.notificationsRules,
    itemsRules: data.itemsRules,
    fieldSchema: data.fieldSchema as unknown as BucketSchema,
    webhookKey: encryptValue(generateWebhookKey()),
    sortOrder: maxRow.max + 1,
  });

  revalidatePath("/");
  return { ok: true };
}

export async function saveAsTemplateAction(
  bucketId: number,
  name: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const existing = await db.query.templates.findFirst({
    where: (t, { and: qand, eq: qeq }) => qand(qeq(t.name, trimmed), qeq(t.userId, session.userId)),
  });

  const rulesJson = JSON.stringify({
    notifications: JSON.parse(bucket.notificationsRules) as unknown,
    items: JSON.parse(bucket.itemsRules) as unknown,
  });
  const fieldSchemaJson = bucket.fieldSchema ? JSON.stringify(bucket.fieldSchema) : null;

  if (existing) {
    await db
      .update(templates)
      .set({ rulesJson, fieldSchemaJson, isBuiltin: false })
      .where(and(eq(templates.id, existing.id), eq(templates.userId, session.userId)));
  } else {
    await db.insert(templates).values({
      userId: session.userId,
      name: trimmed,
      rulesJson,
      fieldSchemaJson,
      isBuiltin: false,
    });
  }

  return { ok: true };
}

export async function deleteUserTemplateAction(
  templateId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  await db
    .delete(templates)
    .where(
      and(
        eq(templates.id, templateId),
        eq(templates.userId, session.userId),
        eq(templates.isBuiltin, false)
      )
    );

  revalidatePath("/");
  return { ok: true };
}
