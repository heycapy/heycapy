import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, chatMessages, chatSessions, users } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";
import { decryptValue } from "@/lib/crypto";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { CAPY_TOOLS, executeToolCall, getUpcomingItems } from "@/lib/ai/capyTools";
import { sendTelegram } from "@/lib/notifications/telegram";
import { compactSessionIfNeeded } from "@/lib/ai/compact";
import { dataEvents } from "@/lib/events";
import type { AgentMessage } from "@/lib/ai/types";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id: number };
  };
};

export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  if (!secret) return new Response("Forbidden", { status: 403 });

  let body: TelegramUpdate;
  try {
    body = (await req.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const text = body.message?.text;
  const chatId = body.message?.chat?.id;

  if (!text || chatId === undefined) return new Response("OK");

  const chatIdStr = String(chatId);

  const row = await db.query.userSettings.findFirst({
    where: (s, { eq: qeq }) => qeq(s.telegramBotToken, secret),
  });

  if (!row || !row.notificationsTelegram || row.telegramChatId !== chatIdStr) {
    return new Response("OK");
  }

  const userId = row.userId;

  const [user, userBuckets] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db
      .select({
        id: buckets.id,
        name: buckets.name,
        icon: buckets.icon,
        itemsRules: buckets.itemsRules,
        notificationsRules: buckets.notificationsRules,
      })
      .from(buckets)
      .where(
        and(eq(buckets.userId, userId), isNull(buckets.deletedAt), isNull(buckets.archivedAt))
      ),
  ]);

  const timezone = row.timezone ?? "UTC";

  // Find or create the persistent telegram session for this user
  let session = await db.query.chatSessions.findFirst({
    where: (s, { eq: qeq, and: qand }) => qand(qeq(s.userId, userId), qeq(s.source, "telegram")),
    orderBy: (s) => desc(s.updatedAt),
  });

  if (!session) {
    const [created] = await db
      .insert(chatSessions)
      .values({ userId, title: "Telegram", source: "telegram" })
      .returning();
    session = created;
  }

  const threshold = row.aiCompactThreshold ?? 40;
  const keepRecent = Math.max(10, Math.floor(threshold / 4));

  // Load recent history
  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, session.id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(keepRecent);

  history.reverse();

  const [upcomingItems, provider] = await Promise.all([
    getUpcomingItems(userId, timezone),
    Promise.resolve(
      getAIProvider({
        provider: row.aiProvider,
        model: row.aiModel,
        apiKey: row.aiApiKey ? decryptValue(row.aiApiKey) : null,
        ollamaUrl: row.aiOllamaUrl,
      })
    ),
  ]);

  const systemMsg: AgentMessage = {
    role: "system",
    content: buildSystemPrompt(row, userBuckets, user?.email ?? "", new Date(), upcomingItems),
  };

  const agentMessages: AgentMessage[] = [
    systemMsg,
    ...(session.summary
      ? [
          {
            role: "system" as const,
            content: `Summary of earlier conversation:\n${session.summary}`,
          },
        ]
      : []),
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: text },
  ];

  let finalText = "";
  let lastAssistantContent = "";

  try {
    for (let round = 0; round < 8; round++) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        provider.complete(agentMessages, CAPY_TOOLS),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("AI provider timeout")), 30_000);
        }),
      ]).finally(() => clearTimeout(timer));

      if (result.content) lastAssistantContent = result.content;

      if (result.toolCalls.length === 0) {
        finalText = result.content ?? "";
        break;
      }

      agentMessages.push({
        role: "assistant",
        content: result.content,
        toolCalls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        const toolResult = await executeToolCall(call, userId, timezone);
        agentMessages.push({
          role: "tool",
          toolCallId: call.id,
          toolName: call.name,
          content: toolResult,
        });
      }
    }

    if (!finalText) finalText = lastAssistantContent;
  } catch (err) {
    process.stderr.write(
      `[telegram] AI error: ${err instanceof Error ? err.message : String(err)}\n`
    );
    return new Response("OK");
  }

  if (!finalText) return new Response("OK");

  try {
    await sendTelegram(secret, chatIdStr, finalText);
  } catch (err) {
    process.stderr.write(
      `[telegram] send error: ${err instanceof Error ? err.message : String(err)}\n`
    );
  }

  await db.insert(chatMessages).values([
    { sessionId: session.id, userId, role: "user", content: text },
    { sessionId: session.id, userId, role: "assistant", content: finalText },
  ]);

  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, session.id));

  void compactSessionIfNeeded(session.id, provider, row.aiCompactThreshold ?? 40);

  dataEvents.emit("refresh", userId);

  return new Response("OK");
}
