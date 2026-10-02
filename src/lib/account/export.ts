import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  aiUsage,
  buckets,
  chatMessages,
  chatSessions,
  creditLedger,
  itemActions,
  items,
  notificationLog,
  outgoingWebhooks,
  pushSubscriptions,
  templates,
  userSettings,
  users,
} from "@/lib/db/schema";

// Stored rules are JSON strings; export them as objects so the file is readable
function parsed(raw: unknown): unknown {
  if (typeof raw !== "string") return raw ?? null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function buildAccountExport(userId: number, now = new Date()) {
  const [
    user,
    settings,
    bucketRows,
    itemRows,
    templateRows,
    history,
    sessions,
    messages,
    devices,
    actions,
    usage,
    credits,
    webhooks,
  ] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) }),
    db.select().from(buckets).where(eq(buckets.userId, userId)).orderBy(asc(buckets.id)),
    db.select().from(items).where(eq(items.userId, userId)).orderBy(asc(items.id)),
    db.select().from(templates).where(eq(templates.userId, userId)).orderBy(asc(templates.id)),
    db
      .select()
      .from(notificationLog)
      .where(eq(notificationLog.userId, userId))
      .orderBy(asc(notificationLog.id)),
    db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(asc(chatSessions.id)),
    db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(asc(chatMessages.id)),
    db
      .select({ name: pushSubscriptions.deviceName, addedAt: pushSubscriptions.createdAt })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId))
      .orderBy(asc(pushSubscriptions.id)),
    db
      .select()
      .from(itemActions)
      .where(eq(itemActions.userId, userId))
      .orderBy(asc(itemActions.id)),
    db.select().from(aiUsage).where(eq(aiUsage.userId, userId)).orderBy(asc(aiUsage.id)),
    db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.userId, userId))
      .orderBy(asc(creditLedger.id)),
    db
      .select({
        name: outgoingWebhooks.name,
        url: outgoingWebhooks.url,
        onForNewBuckets: outgoingWebhooks.isDefault,
      })
      .from(outgoingWebhooks)
      .where(eq(outgoingWebhooks.userId, userId))
      .orderBy(asc(outgoingWebhooks.id)),
  ]);

  return {
    exportedAt: now.toISOString(),
    account: { email: user?.email ?? null, createdAt: user?.createdAt ?? null },
    settings: settings && {
      timezone: settings.timezone,
      theme: settings.theme,
      notifications: {
        email: settings.notificationsEmail,
        emailTo: settings.notificationEmailTo,
        emailProvider: settings.emailProvider,
        smtp: {
          host: settings.smtpHost,
          port: settings.smtpPort,
          user: settings.smtpUser,
          secure: settings.smtpSecure,
          from: settings.smtpFrom,
        },
        ntfy: {
          enabled: settings.notificationsPush,
          url: settings.ntfyUrl,
          topic: settings.ntfyTopic,
        },
        telegram: {
          enabled: settings.notificationsTelegram,
          connected: settings.telegramChatId !== null,
        },
        pushDevices: devices,
        webhooks,
      },
      personality: {
        name: settings.personalityName,
        tone: settings.personalityTone,
        emoji: settings.personalityEmoji,
        customPrompt: settings.personalityCustomPrompt,
      },
      ai: {
        provider: settings.aiProvider,
        model: settings.aiModel,
        ollamaUrl: settings.aiOllamaUrl,
        writesReminderMessages: settings.aiNotifyMessages,
        transcriptionProvider: settings.transcriptionProvider,
        transcriptionModel: settings.transcriptionModel,
      },
    },
    buckets: bucketRows.map((b) => ({
      id: b.id,
      name: b.name,
      icon: b.icon,
      color: b.color,
      itemsRules: parsed(b.itemsRules),
      notificationsRules: parsed(b.notificationsRules),
      fields: parsed(b.fieldSchema),
      telegram: parsed(b.telegramConfig),
      webhookEnabled: b.webhookKey !== null,
      archivedAt: b.archivedAt,
      deletedAt: b.deletedAt,
      createdAt: b.createdAt,
    })),
    items: itemRows.map((i) => ({
      id: i.id,
      bucketId: i.bucketId,
      title: i.title,
      description: i.description,
      status: i.status,
      deadline: i.deadline,
      scheduledAt: i.scheduledAt,
      recurring: parsed(i.recurring),
      reminderOffsets: i.reminderOffsets,
      fields: parsed(i.properties),
      source: i.source,
      completedAt: i.completedAt,
      deletedAt: i.deletedAt,
      createdAt: i.createdAt,
    })),
    templates: templateRows.map((t) => ({
      name: t.name,
      description: t.description,
      rules: parsed(t.rulesJson),
      fields: parsed(t.fieldSchemaJson),
    })),
    notificationHistory: history.map((n) => ({
      itemId: n.itemId,
      channel: n.medium,
      message: n.message,
      status: n.status,
      error: n.error,
      sentAt: n.sentAt,
    })),
    reminderActions: actions.map((a) => ({
      itemId: a.itemId,
      action: a.action,
      from: a.source,
      remindAt: a.remindAt,
      at: a.createdAt,
    })),
    chats: sessions.map((s) => ({
      title: s.title,
      source: s.source,
      createdAt: s.createdAt,
      messages: messages
        .filter((m) => m.sessionId === s.id)
        .map((m) => ({ role: m.role, content: m.content, at: m.createdAt })),
    })),
    aiUsage: usage.map((u) => ({
      source: u.source,
      provider: u.provider,
      model: u.model,
      key: u.key,
      calls: u.calls,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      cacheReadTokens: u.cacheReadTokens,
      cacheWriteTokens: u.cacheWriteTokens,
      at: u.createdAt,
    })),
    credits: credits.map((c) => ({
      amount: c.amount,
      kind: c.kind,
      note: c.note,
      at: c.createdAt,
    })),
  };
}
