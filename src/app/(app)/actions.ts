"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { getSession, deleteSession } from "@/lib/auth/session";
import type { SessionPayload } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  buckets,
  chatMessages,
  chatSessions,
  items,
  itemStatuses,
  userSettings,
} from "@/lib/db/schema";
import { encryptValue, decryptValue } from "@/lib/crypto";
import { TELEGRAM_API_BASE } from "@/constants";
import type { ItemsRulesConfig, NotificationsRulesConfig } from "@/components/buckets/constants";
import type { RecurringConfig } from "@/types/rules";

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
  if (trimmed.length > 100) return { ok: false, error: "Name too long" };

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
  if (trimmed.length > 100) return { ok: false, error: "Name too long" };

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
  recurring?: RecurringConfig | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > 500) return { ok: false, error: "Title too long" };

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
  });

  revalidatePath("/");
  return { ok: true };
}

export async function updateItemAction(
  itemId: number,
  title: string,
  deadline: string | null,
  status?: string,
  recurring?: RecurringConfig | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > 500) return { ok: false, error: "Title too long" };

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .update(items)
    .set({
      title: trimmed,
      deadline: deadline
        ? new Date(deadline.includes("T") ? deadline : deadline + "T12:00:00")
        : null,
      ...(status !== undefined && { status }),
      ...(status === "completed" && item.status !== "completed" && { completedAt: new Date() }),
      ...(status !== undefined &&
        status !== "completed" &&
        item.status === "completed" && { completedAt: null }),
      ...(recurring !== undefined && {
        recurring: recurring?.enabled ? JSON.stringify(recurring) : null,
      }),
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));

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

const SYSTEM_STATUS_SEEDS = [
  { name: "active", color: "var(--status-active)", sortOrder: 0, isSystem: true as const },
  { name: "completed", color: "var(--status-completed)", sortOrder: 1, isSystem: true as const },
  { name: "snoozed", color: "var(--status-snoozed)", sortOrder: 2, isSystem: true as const },
];

export async function getItemStatusesAction(): Promise<
  { ok: true; statuses: (typeof itemStatuses.$inferSelect)[] } | { ok: false; error: string }
> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Unauthorized" };

  const existing = await db
    .select()
    .from(itemStatuses)
    .where(eq(itemStatuses.userId, session.userId));

  if (existing.length === 0) {
    await db
      .insert(itemStatuses)
      .values(SYSTEM_STATUS_SEEDS.map((s) => ({ ...s, userId: session.userId })));
    const seeded = await db
      .select()
      .from(itemStatuses)
      .where(eq(itemStatuses.userId, session.userId));
    return { ok: true, statuses: seeded.sort((a, b) => a.sortOrder - b.sortOrder) };
  }

  return { ok: true, statuses: existing.sort((a, b) => a.sortOrder - b.sortOrder) };
}

export async function createItemStatusAction(
  name: string,
  color: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  if (trimmed.length > 30) return { ok: false, error: "Name too long" };

  const existing = await db
    .select({ id: itemStatuses.id })
    .from(itemStatuses)
    .where(
      and(
        eq(itemStatuses.userId, session.userId),
        sql`lower(${itemStatuses.name}) = lower(${trimmed})`
      )
    )
    .limit(1);
  if (existing.length > 0) return { ok: false, error: "Status already exists" };

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${itemStatuses.sortOrder}), 2)` })
    .from(itemStatuses)
    .where(eq(itemStatuses.userId, session.userId));

  await db.insert(itemStatuses).values({
    userId: session.userId,
    name: trimmed,
    color,
    sortOrder: (maxRow?.max ?? 2) + 1,
    isSystem: false,
  });

  return { ok: true };
}

export async function updateItemStatusAction(
  id: number,
  color: string,
  name?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const status = await db.query.itemStatuses.findFirst({
    where: (s, { eq: qeq, and: qand }) => qand(qeq(s.id, id), qeq(s.userId, session.userId)),
  });
  if (!status) return { ok: false, error: "Status not found" };

  const updates: { color: string; name?: string } = { color };
  if (name !== undefined && !status.isSystem) {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Name is required" };
    if (trimmed.length > 30) return { ok: false, error: "Name too long" };
    updates.name = trimmed;
  }

  await db
    .update(itemStatuses)
    .set(updates)
    .where(and(eq(itemStatuses.id, id), eq(itemStatuses.userId, session.userId)));

  if (updates.name !== undefined && updates.name !== status.name) {
    await db
      .update(items)
      .set({ status: updates.name })
      .where(and(eq(items.userId, session.userId), eq(items.status, status.name)));
  }

  return { ok: true };
}

export async function deleteItemStatusAction(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession();

  const status = await db.query.itemStatuses.findFirst({
    where: (s, { eq: qeq, and: qand }) => qand(qeq(s.id, id), qeq(s.userId, session.userId)),
  });
  if (!status) return { ok: false, error: "Status not found" };
  if (status.isSystem) return { ok: false, error: "Cannot delete system statuses" };

  await db
    .update(items)
    .set({ status: "active", updatedAt: new Date() })
    .where(and(eq(items.userId, session.userId), eq(items.status, status.name)));

  await db
    .delete(itemStatuses)
    .where(and(eq(itemStatuses.id, id), eq(itemStatuses.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
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
