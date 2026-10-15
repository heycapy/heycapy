import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberBucketIds, withoutOwnerSecrets } from "@/lib/buckets/access";
import { inLiveBucket } from "@/lib/buckets/live";
import { memberName } from "@/lib/buckets/member-name";
import { memberChannels } from "@/lib/rules";
import {
  aiUsage,
  bucketMembers,
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

function exportedBucketIds(userId: number) {
  return db
    .select({ id: buckets.id })
    .from(buckets)
    .where(
      or(
        eq(buckets.userId, userId),
        and(inArray(buckets.id, memberBucketIds(userId)), inLiveBucket)
      )
    );
}

async function namesOf(userId: number, ids: number[]): Promise<Map<number, string>> {
  const people = ids.length
    ? await db
        .select({ id: users.id, displayName: users.displayName, username: users.username })
        .from(users)
        .where(inArray(users.id, ids))
    : [];
  const names = new Map(people.map((p) => [p.id, memberName(p)]));
  names.set(userId, "you");
  return names;
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
    memberships,
    webhookNames,
  ] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) }),
    db
      .select()
      .from(buckets)
      .where(inArray(buckets.id, exportedBucketIds(userId)))
      .orderBy(asc(buckets.id)),
    db
      .select()
      .from(items)
      .where(inArray(items.bucketId, exportedBucketIds(userId)))
      .orderBy(asc(items.id)),
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
    db
      .select({ bucketId: bucketMembers.bucketId, channels: bucketMembers.channels })
      .from(bucketMembers)
      .where(eq(bucketMembers.userId, userId)),
    db
      .select({ id: outgoingWebhooks.id, name: outgoingWebhooks.name })
      .from(outgoingWebhooks)
      .where(eq(outgoingWebhooks.userId, userId)),
  ]);

  const yourChannels = (bucketId: number) => {
    const membership = memberships.find((m) => m.bucketId === bucketId);
    if (!membership) return null;
    const { medium, webhooks: ids } = memberChannels(membership.channels);
    return {
      medium,
      webhooks: webhookNames.filter((w) => ids.includes(w.id)).map((w) => w.name),
    };
  };

  const names = await namesOf(userId, [
    ...new Set([
      ...bucketRows.map((b) => b.userId),
      ...itemRows.flatMap((i) => (i.assigneeId === null ? [i.userId] : [i.userId, i.assigneeId])),
    ]),
  ]);
  const nameOf = (id: number) => names.get(id) ?? "someone";

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
    buckets: bucketRows.map((row) => {
      const b = withoutOwnerSecrets(row, userId);
      const owned = row.userId === userId;
      return {
        id: b.id,
        name: b.name,
        icon: b.icon,
        color: b.color,
        owner: nameOf(b.userId),
        itemsRules: parsed(b.itemsRules),
        notificationsRules: parsed(b.notificationsRules),
        yourChannels: yourChannels(b.id),
        fields: parsed(b.fieldSchema),
        telegram: parsed(b.telegramConfig),
        webhookEnabled: owned ? b.webhookKey !== null : null,
        archivedAt: b.archivedAt,
        deletedAt: b.deletedAt,
        createdAt: b.createdAt,
      };
    }),
    items: itemRows.map((i) => ({
      id: i.id,
      bucketId: i.bucketId,
      title: i.title,
      description: i.description,
      addedBy: nameOf(i.userId),
      assignedTo: i.assigneeId === null ? null : nameOf(i.assigneeId),
      status: i.status,
      deadline: i.deadline,
      deadlineTimezone: i.deadlineTimezone,
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
