"use server";

import { QUICK_REMIND_VALUES } from "@/lib/notifications/constants";
import type { ActionResult } from "@/types/result";
import { revalidatePath } from "next/cache";
import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { requireSession } from "./action-helpers";
import { db } from "@/lib/db";
import { buckets } from "@/lib/db/schema";
import { encryptValue, decryptValue, generateWebhookKey } from "@/lib/crypto";
import { z } from "zod";
import {
  BUCKET_NAME_MAX_LENGTH,
  DUPLICATE_BUCKET_NAME_ERROR,
  TELEGRAM_ALIAS_MAX_LENGTH,
  TELEGRAM_RESERVED_COMMANDS,
} from "@/constants";
import { findBucketByName } from "@/lib/db/buckets";
import { withDefaultChannels } from "@/lib/notifications/channels";
import { refreshBucketReminders } from "@/lib/reminders/refresh";
import {
  TELEGRAM_DEADLINE_PRESETS,
  TELEGRAM_RECURRING_OPTIONS,
  type ItemsRulesConfig,
  type NotificationsRulesConfig,
  type TelegramBotConfig,
} from "@/components/buckets/constants";
import { BucketSchema } from "@/types/rules";
import { buildPropertyValidator } from "@/types/rules";

const TelegramBotConfigInput = z.object({
  alias: z
    .string()
    .regex(
      new RegExp(`^[a-z0-9_]{1,${TELEGRAM_ALIAS_MAX_LENGTH}}$`),
      `Alias must be 1-${TELEGRAM_ALIAS_MAX_LENGTH} lowercase letters, digits or underscores`
    )
    .nullable(),
  deadlinePresets: z
    .array(z.enum(TELEGRAM_DEADLINE_PRESETS.map((p) => p.value)))
    .min(1, "Pick at least one deadline button"),
  showRecurring: z.boolean(),
  defaultRecurring: z.enum(TELEGRAM_RECURRING_OPTIONS.map((o) => o.value)),
  timeSlots: z
    .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time slot"))
    .min(1, "Pick at least one time")
    .max(24),
}) satisfies z.ZodType<TelegramBotConfig>;

function parseStoredRules(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function createBucketAction(
  templateId: number,
  name: string
): Promise<ActionResult<{ bucketId: number }>> {
  const session = await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  if (trimmed.length > BUCKET_NAME_MAX_LENGTH) return { ok: false, error: "Name too long" };

  if (await findBucketByName(session.userId, trimmed)) {
    return { ok: false, error: DUPLICATE_BUCKET_NAME_ERROR };
  }

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

  const [newBucket] = await db
    .insert(buckets)
    .values({
      userId: session.userId,
      name: trimmed,
      notificationsRules: JSON.stringify(
        await withDefaultChannels(session.userId, rules.notifications)
      ),
      itemsRules: JSON.stringify(rules.items ?? {}),
      mcpRules: rules.mcp ? JSON.stringify(rules.mcp) : null,
      personalityRules: JSON.stringify(rules.personality ?? {}),
      fieldSchema: (template.fieldSchemaJson ?? null) as unknown as BucketSchema,
      webhookKey: encryptValue(generateWebhookKey()),
      sortOrder: maxRow.max + 1,
    })
    .returning({ id: buckets.id });

  revalidatePath("/");
  return { ok: true, bucketId: newBucket.id };
}

type NotificationTriggers = {
  notifyOnArrival?: boolean;
  notifyWhenOverdue?: boolean;
  overdueRepeatHours?: number | undefined;
  overdueFirstAlertMins?: number | undefined;
};

export async function updateBucketSettingsAction(
  bucketId: number,
  name: string,
  itemsRules: ItemsRulesConfig,
  notificationsRules: NotificationsRulesConfig,
  telegramConfig?: TelegramBotConfig | null,
  notificationTriggers?: NotificationTriggers
): Promise<ActionResult> {
  const session = await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  if (trimmed.length > BUCKET_NAME_MAX_LENGTH) return { ok: false, error: "Name too long" };

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  if (await findBucketByName(session.userId, trimmed, bucketId)) {
    return { ok: false, error: DUPLICATE_BUCKET_NAME_ERROR };
  }

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
        overdueFirstAlertMins: notificationTriggers.notifyWhenOverdue
          ? notificationTriggers.overdueFirstAlertMins
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
      notificationsRules: JSON.stringify({
        ...parseStoredRules(bucket.notificationsRules),
        ...notificationsRules,
        ...(notificationsRules.reminderButtons && {
          reminderButtons: QUICK_REMIND_VALUES.filter((v) =>
            notificationsRules.reminderButtons?.includes(v)
          ),
        }),
      }),
      ...(telegramConfig !== undefined
        ? { telegramConfig: telegramConfig ? JSON.stringify(telegramConfig) : null }
        : {}),
      ...(notificationTriggers !== undefined
        ? { fieldSchema: JSON.stringify(updatedFieldSchema) as unknown as BucketSchema }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));
  await refreshBucketReminders(bucketId);

  revalidatePath("/");
  return { ok: true };
}

export async function updateBucketTelegramConfigAction(
  bucketId: number,
  config: TelegramBotConfig
): Promise<ActionResult> {
  const session = await requireSession();
  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const parsed = TelegramBotConfigInput.safeParse(config);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid telegram config" };
  }
  const { alias } = parsed.data;

  if (alias) {
    if ((TELEGRAM_RESERVED_COMMANDS as readonly string[]).includes(alias)) {
      return { ok: false, error: `/${alias} is a built-in bot command — pick another alias` };
    }
    const others = await db
      .select({ id: buckets.id, name: buckets.name, telegramConfig: buckets.telegramConfig })
      .from(buckets)
      .where(and(eq(buckets.userId, session.userId), isNull(buckets.deletedAt)));
    const clash = others.find((b) => {
      if (!b.telegramConfig || b.id === bucketId) return false;
      try {
        return (JSON.parse(b.telegramConfig) as { alias?: unknown }).alias === alias;
      } catch {
        return false;
      }
    });
    if (clash) return { ok: false, error: `/${alias} is already used by "${clash.name}"` };
  }

  await db
    .update(buckets)
    .set({ telegramConfig: JSON.stringify(parsed.data), updatedAt: new Date() })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));
  revalidatePath("/");
  return { ok: true };
}

export async function archiveBucketAction(bucketId: number): Promise<ActionResult> {
  const session = await requireSession();

  await db
    .update(buckets)
    .set({ archivedAt: new Date() })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function restoreBucketAction(bucketId: number): Promise<ActionResult> {
  const session = await requireSession();

  await db
    .update(buckets)
    .set({ archivedAt: null })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function deleteBucketAction(bucketId: number): Promise<ActionResult> {
  const session = await requireSession();

  await db
    .update(buckets)
    .set({ deletedAt: new Date() })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function restoreDeletedBucketAction(bucketId: number): Promise<ActionResult> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };
  if (await findBucketByName(session.userId, bucket.name, bucketId)) {
    return {
      ok: false,
      error: `A bucket named "${bucket.name}" already exists. Rename it before restoring this one.`,
    };
  }

  await db
    .update(buckets)
    .set({ deletedAt: null })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function permanentlyDeleteBucketAction(bucketId: number): Promise<ActionResult> {
  const session = await requireSession();

  await db.delete(buckets).where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function getDeletedBucketsAction(): Promise<
  ActionResult<{ buckets: (typeof buckets.$inferSelect)[] }>
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
  ActionResult<{ buckets: (typeof buckets.$inferSelect)[] }>
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
): Promise<ActionResult> {
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
    ...(existing.overdueFirstAlertMins !== undefined && {
      overdueFirstAlertMins: existing.overdueFirstAlertMins,
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
): Promise<ActionResult<{ key: string }>> {
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
): Promise<ActionResult<{ key: string }>> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };
  if (!bucket.webhookKey) return { ok: false, error: "No webhook key set" };

  return { ok: true, key: decryptValue(bucket.webhookKey) };
}
