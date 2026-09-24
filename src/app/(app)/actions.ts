"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getSession, deleteSession } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets, chatMessages, chatSessions, items, userSettings } from "@/lib/db/schema";
import { encryptValue, decryptValue, generateWebhookKey } from "@/lib/crypto";
import { TELEGRAM_API_BASE, ITEM_TITLE_MAX_LENGTH, BUCKET_NAME_MAX_LENGTH } from "@/constants";
import type { ItemsRulesConfig, NotificationsRulesConfig } from "@/components/buckets/constants";
import { BucketSchema } from "@/types/rules";
import type { RecurringConfig } from "@/types/rules";
import { buildPropertyValidator } from "@/types/rules";
import { enqueue, processPending } from "@/lib/notifications/queue";
import type { NotificationMedium } from "@/lib/notifications/queue";

async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function getUserSettingsAction(): Promise<
  { ok: true; settings: typeof userSettings.$inferSelect } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const settings = await db.query.userSettings.findFirst({
    where: (s, { eq: qeq }) => qeq(s.userId, session.userId),
  });
  if (!settings) return { ok: false, error: "Settings not found" };

  return {
    ok: true,
    settings: {
      ...settings,
      aiApiKey: settings.aiApiKey ? decryptValue(settings.aiApiKey) : null,
      transcriptionApiKey: settings.transcriptionApiKey
        ? decryptValue(settings.transcriptionApiKey)
        : null,
    },
  };
}

type UserSettingsUpdate = {
  personalityName: string;
  personalityTone: "chill" | "professional" | "motivational" | "custom";
  personalityEmoji: boolean;
  personalityCustomPrompt: string | null;
  timezone: string;
  aiProvider: "ollama" | "openai" | "anthropic" | "groq" | "gemini" | null;
  aiApiKey: string | null;
  aiModel: string | null;
  aiOllamaUrl: string | null;
  aiCompactThreshold: number;
  notificationsEmail: boolean;
  notificationsPush: boolean;
  ntfyUrl: string | null;
  ntfyTopic: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  notificationsTelegram: boolean;
  transcriptionProvider: string | null;
  transcriptionApiKey: string | null;
  transcriptionModel: string | null;
};

export async function updateUserSettingsAction(
  data: UserSettingsUpdate
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const trimmedName = data.personalityName.trim();
  if (!trimmedName) return { ok: false, error: "Name is required" };
  if (trimmedName.length > 50) return { ok: false, error: "Name too long" };

  await db
    .update(userSettings)
    .set({
      personalityName: trimmedName,
      personalityTone: data.personalityTone,
      personalityEmoji: data.personalityEmoji,
      personalityCustomPrompt: data.personalityCustomPrompt || null,
      timezone: data.timezone || "UTC",
      aiProvider: data.aiProvider,
      aiApiKey: data.aiApiKey ? encryptValue(data.aiApiKey) : null,
      aiModel: data.aiModel || null,
      aiOllamaUrl: data.aiOllamaUrl || null,
      aiCompactThreshold: data.aiCompactThreshold,
      notificationsEmail: data.notificationsEmail,
      notificationsPush: data.notificationsPush,
      ntfyUrl: data.ntfyUrl || null,
      ntfyTopic: data.ntfyTopic || null,
      telegramBotToken: data.telegramBotToken || null,
      telegramChatId: data.telegramChatId || null,
      notificationsTelegram: data.notificationsTelegram,
      transcriptionProvider: data.transcriptionProvider || null,
      transcriptionApiKey: data.transcriptionApiKey ? encryptValue(data.transcriptionApiKey) : null,
      transcriptionModel: data.transcriptionModel || null,
      updatedAt: new Date(),
    })
    .where(eq(userSettings.userId, session.userId));

  const newToken = data.telegramBotToken || null;
  if (newToken) {
    const h = await headers();
    const proto = h.get("x-forwarded-proto") ?? "http";
    const host = h.get("host") ?? "localhost:3000";
    const appUrl = process.env.APP_URL ?? `${proto}://${host}`;
    const webhookUrl = `${appUrl}/api/telegram?secret=${encodeURIComponent(newToken)}`;
    try {
      await fetch(`${TELEGRAM_API_BASE}/bot${newToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
    } catch {
      // non-fatal — webhook registration failure doesn't block saving settings
    }
  }

  return { ok: true };
}

export async function getItemsForBucketAction(
  bucketId: number
): Promise<{ ok: true; items: (typeof items.$inferSelect)[] } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  let sortBy = "manual";
  try {
    const parsed = JSON.parse(bucket.itemsRules) as { sortBy?: string; sort_by?: string };
    sortBy = parsed.sortBy ?? parsed.sort_by ?? "manual";
  } catch (err) {
    process.stderr.write(
      `[actions] bucket ${bucketId} has malformed itemsRules: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }

  const condition = and(
    eq(items.bucketId, bucketId),
    eq(items.userId, session.userId),
    isNull(items.deletedAt)
  );

  const result =
    sortBy === "deadline"
      ? await db
          .select()
          .from(items)
          .where(condition)
          .orderBy(sql`${items.deadline} IS NULL`, asc(items.deadline), asc(items.createdAt))
      : sortBy === "created_at"
        ? await db.select().from(items).where(condition).orderBy(asc(items.createdAt))
        : await db
            .select()
            .from(items)
            .where(condition)
            .orderBy(asc(items.sortOrder), asc(items.createdAt));

  return { ok: true, items: result };
}

export async function updateBucketSettingsAction(
  bucketId: number,
  name: string,
  itemsRules: ItemsRulesConfig,
  notificationsRules: NotificationsRulesConfig
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  if (trimmed.length > BUCKET_NAME_MAX_LENGTH) return { ok: false, error: "Name too long" };

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  await db
    .update(buckets)
    .set({
      name: trimmed,
      itemsRules: JSON.stringify(itemsRules),
      notificationsRules: JSON.stringify(notificationsRules),
      updatedAt: new Date(),
    })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

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

export async function addItemAction(
  bucketId: number,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null,
  properties?: Record<string, unknown> | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
    .from(items)
    .where(eq(items.bucketId, bucketId));

  await db.insert(items).values({
    bucketId,
    userId: session.userId,
    title: trimmed,
    deadline: deadline
      ? new Date(deadline.includes("T") ? deadline : deadline + "T12:00:00")
      : null,
    status: status ?? "active",
    sortOrder: maxRow.max + 1,
    recurring: recurring?.enabled ? JSON.stringify(recurring) : null,
    properties: properties ? JSON.stringify(properties) : null,
  });

  revalidatePath("/");
  return { ok: true };
}

export async function updateItemAction(
  itemId: number,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null,
  properties?: Record<string, unknown> | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > ITEM_TITLE_MAX_LENGTH) return { ok: false, error: "Title too long" };

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  const newDeadline = deadline
    ? new Date(deadline.includes("T") ? deadline : deadline + "T12:00:00")
    : null;
  const deadlineChanged = (item.deadline?.getTime() ?? null) !== (newDeadline?.getTime() ?? null);

  await db
    .update(items)
    .set({
      title: trimmed,
      deadline: newDeadline,
      ...(deadlineChanged && { notifiedAt: null, overdueNotifiedAt: null }),
      ...(status !== undefined && { status }),
      ...(status === "completed" && item.status !== "completed" && { completedAt: new Date() }),
      ...(status !== undefined &&
        status !== "completed" &&
        item.status === "completed" && { completedAt: null }),
      ...(recurring !== undefined && {
        recurring: recurring?.enabled ? JSON.stringify(recurring) : null,
      }),
      ...(properties !== undefined && {
        properties: properties ? JSON.stringify(properties) : null,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));

  if (status !== undefined && status !== item.status) {
    const bucket = await db.query.buckets.findFirst({
      where: (b, { eq: qeq }) => qeq(b.id, item.bucketId),
    });
    if (bucket?.fieldSchema) {
      const parsed = BucketSchema.safeParse(
        typeof bucket.fieldSchema === "string" ? JSON.parse(bucket.fieldSchema) : bucket.fieldSchema
      );
      if (parsed.success) {
        const matchingStatus = parsed.data.statuses.find(
          (st) => st.name === status && st.notifyOnReach
        );
        if (matchingStatus) {
          const userRow = await db.query.userSettings.findFirst({
            where: (s, { eq: qeq }) => qeq(s.userId, session.userId),
          });
          if (userRow) {
            const mediums: NotificationMedium[] = [];
            if (userRow.notificationsEmail) mediums.push("email");
            if (userRow.notificationsPush && userRow.ntfyUrl && userRow.ntfyTopic)
              mediums.push("ntfy");
            if (userRow.notificationsTelegram && userRow.telegramBotToken && userRow.telegramChatId)
              mediums.push("telegram");

            const notifTitle = `[${bucket.name}] Status updated`;
            const message = `"${trimmed}" is now ${status}.`;

            await Promise.all(
              mediums.map((medium) =>
                enqueue({ userId: session.userId, itemId, medium, title: notifTitle, message })
              )
            );
            void processPending().catch((err) => {
              process.stderr.write(`[actions] processPending error: ${String(err)}\n`);
            });
          }
        }
      }
    }
  }

  revalidatePath("/");
  return { ok: true };
}

export async function completeItemAction(
  itemId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  const newStatus = item.status === "completed" ? "active" : "completed";
  await db
    .update(items)
    .set({
      status: newStatus,
      completedAt: newStatus === "completed" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function reorderItemsAction(
  bucketId: number,
  orderedIds: number[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(items)
        .set({ sortOrder: i })
        .where(and(eq(items.id, orderedIds[i]), eq(items.userId, session.userId)));
    }
  });

  revalidatePath("/");
  return { ok: true };
}

export async function deleteItemAction(
  itemId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .update(items)
    .set({ deletedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));

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

export async function getChatSessionsAction(): Promise<
  { id: number; title: string; updatedAt: Date }[]
> {
  const session = await getSession();
  if (!session) return [];

  const result = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, session.userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(50);

  return result;
}

export async function getChatMessagesAction(
  sessionId: number
): Promise<{ role: "user" | "assistant"; content: string }[] | null> {
  const session = await getSession();
  if (!session) return null;

  const owned = await db.query.chatSessions.findFirst({
    where: (s, { eq: qeq, and: qand }) => qand(qeq(s.id, sessionId), qeq(s.userId, session.userId)),
  });
  if (!owned) return null;

  const msgs = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));

  return msgs;
}

export async function deleteChatSessionAction(sessionId: number): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };

  const owned = await db.query.chatSessions.findFirst({
    where: (s, { eq: qeq, and: qand }) => qand(qeq(s.id, sessionId), qeq(s.userId, session.userId)),
  });
  if (!owned) return { ok: false };

  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));

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

  await db
    .update(buckets)
    .set({
      fieldSchema: JSON.stringify(parsed.data) as unknown as BucketSchema,
      updatedAt: new Date(),
    })
    .where(and(eq(buckets.id, bucketId), eq(buckets.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function registerTelegramWebhookAction(
  botToken: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  if (!botToken.trim()) return { ok: false, error: "Bot token is required" };

  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const appUrl = process.env.APP_URL ?? `${proto}://${host}`;
  const webhookUrl = `${appUrl}/api/telegram?secret=${encodeURIComponent(botToken)}`;

  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) return { ok: false, error: data.description ?? "Telegram rejected the request" };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
