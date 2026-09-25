import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, chatMessages, chatSessions, userSettings, users } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";
import { decryptValue } from "@/lib/crypto";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { CAPY_TOOLS, executeToolCall, getUpcomingItems } from "@/lib/ai/capyTools";
import {
  sendTelegram,
  sendTelegramButtons,
  sendTelegramWithQuickActions,
  answerCallbackQuery,
  sendChatAction,
} from "@/lib/notifications/telegram";
import { compactSessionIfNeeded } from "@/lib/ai/compact";
import { dataEvents } from "@/lib/events";
import { errorMessage } from "@/lib/errors";
import type { AgentMessage } from "@/lib/ai/types";
import type {
  TelegramDeadlinePreset,
  TelegramRecurringDefault,
} from "@/components/buckets/constants";
import {
  getFlowState,
  setFlowState,
  getBucketTelegramConfig,
  getLocalDateStr,
  getEndOfMonthDateStr,
  getUserBuckets,
  applyTimeToDate,
  parseTimeString,
} from "./telegram-utils";
import type { TelegramUpdate } from "./telegram-utils";
import {
  showBucketPicker,
  showDeadlinePicker,
  showTimePicker,
  showCalendar,
  handleAfterTime,
  handleAfterDeadline,
  handleRepeatCallback,
} from "./telegram-flow";
import {
  cmdBuckets,
  cmdList,
  cmdDue,
  cmdOverdue,
  cmdAddDirect,
  buildHelpText,
} from "./telegram-commands";
import { parseNaturalDeadline } from "./telegram-utils";

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return new Response("Not configured", { status: 503 });

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");
  if (!secret || secret !== botToken) return new Response("Forbidden", { status: 403 });

  let body: TelegramUpdate;
  try {
    body = (await req.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const isCallback = !!body.callback_query;
  const chatId = isCallback ? body.callback_query?.message?.chat?.id : body.message?.chat?.id;
  const text = body.message?.text?.trim();
  const callbackData = body.callback_query?.data;
  const callbackQueryId = body.callback_query?.id;

  if (chatId === undefined) return new Response("OK");
  if (!isCallback && !text) return new Response("OK");
  const chatIdStr = String(chatId);

  if (callbackQueryId) await answerCallbackQuery(botToken, callbackQueryId).catch(() => {});

  if (text === "/start") {
    const existing = await db.query.userSettings.findFirst({
      where: (s, { eq: qeq }) => qeq(s.telegramChatId, chatIdStr),
    });
    if (existing) {
      await sendTelegramWithQuickActions(botToken, chatIdStr, "Already connected to heycapy ✓");
      return new Response("OK");
    }
    const unconnected = await db.query.userSettings.findFirst({
      where: (s, { isNull: qNull }) => qNull(s.telegramChatId),
    });
    if (!unconnected) {
      await sendTelegram(botToken, chatIdStr, "No accounts available to connect.");
      return new Response("OK");
    }
    await db
      .update(userSettings)
      .set({ telegramChatId: chatIdStr, notificationsTelegram: true })
      .where(eq(userSettings.id, unconnected.id));
    await sendTelegramWithQuickActions(
      botToken,
      chatIdStr,
      "Connected to heycapy ✓\nYou can now chat with Capy and receive notifications here."
    );
    return new Response("OK");
  }

  const row = await db.query.userSettings.findFirst({
    where: (s, { eq: qeq }) => qeq(s.telegramChatId, chatIdStr),
  });
  if (!row) return new Response("OK");

  const userId = row.userId;
  const timezone = row.timezone ?? "UTC";
  const flowState = getFlowState(row.telegramState ?? null);

  if (isCallback && callbackData) {
    if (callbackData === "_") return new Response("OK");

    if (callbackData === "cancel") {
      await setFlowState(userId, null);
      await sendTelegramWithQuickActions(botToken, chatIdStr, "Cancelled.");
      return new Response("OK");
    }

    if (callbackData.startsWith("ab:")) {
      const parts = callbackData.slice(3).split(":");
      const bucketId = Number(parts[0]);
      const bucketName = parts.slice(1).join(":") || "Bucket";
      await setFlowState(userId, { s: "title", bucketId, bucketName });
      await sendTelegramButtons(
        botToken,
        chatIdStr,
        `Adding to ${bucketName}.\n\nWhat's the title?`,
        [[{ text: "✖ Cancel", callback_data: "cancel" }]]
      );
      return new Response("OK");
    }

    if (callbackData.startsWith("ad:") && flowState?.s === "deadline") {
      const preset = callbackData.slice(3) as TelegramDeadlinePreset;

      if (preset === "today" || preset === "tomorrow") {
        const offset = preset === "today" ? 0 : 1;
        const dateStr = getLocalDateStr(new Date(Date.now() + offset * 86_400_000), timezone);
        const presetConfig = await getBucketTelegramConfig(flowState.bucketId);
        await setFlowState(userId, {
          s: "time",
          bucketId: flowState.bucketId,
          bucketName: flowState.bucketName,
          title: flowState.title,
          date: dateStr,
          isToday: preset === "today",
        });
        await showTimePicker(
          botToken,
          chatIdStr,
          flowState,
          timezone,
          preset === "today",
          presetConfig.timeSlots
        );
        return new Response("OK");
      }

      if (preset === "end_of_month") {
        const dateStr = getEndOfMonthDateStr(timezone);
        const eomConfig = await getBucketTelegramConfig(flowState.bucketId);
        await setFlowState(userId, {
          s: "time",
          bucketId: flowState.bucketId,
          bucketName: flowState.bucketName,
          title: flowState.title,
          date: dateStr,
          isToday: false,
        });
        await showTimePicker(
          botToken,
          chatIdStr,
          { ...flowState, bucketName: `${flowState.bucketName} (end of month)` },
          timezone,
          false,
          eomConfig.timeSlots
        );
        return new Response("OK");
      }

      if (preset === "pick_date") {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        await setFlowState(userId, {
          s: "cal",
          bucketId: flowState.bucketId,
          bucketName: flowState.bucketName,
          title: flowState.title,
          month: monthStr,
        });
        await showCalendar(botToken, chatIdStr, monthStr, flowState.title, flowState.bucketName);
        return new Response("OK");
      }

      const deadline = preset === "this_week" ? parseNaturalDeadline("next week", timezone) : null;
      await handleAfterDeadline(botToken, chatIdStr, userId, flowState, deadline, timezone);
      return new Response("OK");
    }

    if (callbackData.startsWith("cm:") && flowState?.s === "cal") {
      const newMonth = callbackData.slice(3);
      await setFlowState(userId, { ...flowState, month: newMonth });
      await showCalendar(botToken, chatIdStr, newMonth, flowState.title, flowState.bucketName);
      return new Response("OK");
    }

    if (callbackData.startsWith("cd:") && flowState?.s === "cal") {
      const dateStr = callbackData.slice(3);
      const today = getLocalDateStr(new Date(), timezone);
      const calConfig = await getBucketTelegramConfig(flowState.bucketId);
      await setFlowState(userId, {
        s: "time",
        bucketId: flowState.bucketId,
        bucketName: flowState.bucketName,
        title: flowState.title,
        date: dateStr,
        isToday: dateStr === today,
      });
      await showTimePicker(
        botToken,
        chatIdStr,
        flowState,
        timezone,
        dateStr === today,
        calConfig.timeSlots
      );
      return new Response("OK");
    }

    if (callbackData.startsWith("at:") && flowState?.s === "time") {
      const when = callbackData.slice(3);
      if (when === "custom") {
        await setFlowState(userId, {
          s: "ctime",
          bucketId: flowState.bucketId,
          bucketName: flowState.bucketName,
          title: flowState.title,
          date: flowState.date,
        });
        await sendTelegramButtons(botToken, chatIdStr, "Type a time (e.g. 3pm, 15:30, 9am):", [
          [{ text: "✖ Cancel", callback_data: "cancel" }],
        ]);
        return new Response("OK");
      }
      let deadline: Date;
      if (when === "none") {
        const [hStr, mStr] = ["12", "0"];
        deadline = applyTimeToDate(flowState.date, parseInt(hStr), parseInt(mStr), timezone);
      } else {
        const [hStr, mStr] = when.split(":");
        deadline = applyTimeToDate(
          flowState.date,
          parseInt(hStr ?? "12"),
          parseInt(mStr ?? "0"),
          timezone
        );
      }
      await handleAfterTime(botToken, chatIdStr, userId, flowState, deadline, timezone);
      return new Response("OK");
    }

    if (callbackData.startsWith("rp:") && flowState?.s === "repeat") {
      const freq = callbackData.slice(3) as TelegramRecurringDefault;
      await handleRepeatCallback(botToken, chatIdStr, userId, flowState, freq, timezone);
      return new Response("OK");
    }

    return new Response("OK");
  }

  if (!text) return new Response("OK");

  if (flowState?.s === "title") {
    const title = text.trim();
    if (!title) {
      await sendTelegram(botToken, chatIdStr, "Title cannot be empty. Try again:");
      return new Response("OK");
    }
    await setFlowState(userId, {
      s: "deadline",
      bucketId: flowState.bucketId,
      bucketName: flowState.bucketName,
      title,
    });
    await showDeadlinePicker(botToken, chatIdStr, {
      bucketId: flowState.bucketId,
      bucketName: flowState.bucketName,
      title,
    });
    return new Response("OK");
  }

  if (flowState?.s === "ctime" || flowState?.s === "time") {
    const parsed = parseTimeString(text);
    if (!parsed) {
      await sendTelegram(
        botToken,
        chatIdStr,
        `Couldn't parse "${text}". Try "3pm", "15:30", or "9am":`
      );
      return new Response("OK");
    }
    const deadline = applyTimeToDate(flowState.date, parsed.hour, parsed.minute, timezone);
    await handleAfterTime(botToken, chatIdStr, userId, flowState, deadline, timezone);
    return new Response("OK");
  }

  const lower = text.toLowerCase();

  if (
    lower.startsWith("/") &&
    !lower.startsWith("/add") &&
    !lower.startsWith("/help") &&
    !lower.startsWith("/buckets") &&
    !lower.startsWith("/list") &&
    !lower.startsWith("/due") &&
    !lower.startsWith("/overdue")
  ) {
    const spaceIdx = text.indexOf(" ");
    const alias = (spaceIdx === -1 ? text.slice(1) : text.slice(1, spaceIdx)).toLowerCase();
    const titlePart = spaceIdx === -1 ? "" : text.slice(spaceIdx + 1).trim();
    const allUserBuckets = await getUserBuckets(userId);
    let matchedBucket: (typeof allUserBuckets)[0] | undefined;
    for (const b of allUserBuckets) {
      const cfg = await getBucketTelegramConfig(b.id);
      if (cfg.alias === alias) {
        matchedBucket = b;
        break;
      }
    }
    if (matchedBucket) {
      if (titlePart) {
        await setFlowState(userId, {
          s: "deadline",
          bucketId: matchedBucket.id,
          bucketName: matchedBucket.name,
          title: titlePart,
        });
        await showDeadlinePicker(botToken, chatIdStr, {
          bucketId: matchedBucket.id,
          bucketName: matchedBucket.name,
          title: titlePart,
        });
      } else {
        await setFlowState(userId, {
          s: "title",
          bucketId: matchedBucket.id,
          bucketName: matchedBucket.name,
        });
        await sendTelegramButtons(
          botToken,
          chatIdStr,
          `Adding to ${matchedBucket.name}.\n\nWhat's the title?`,
          [[{ text: "✖ Cancel", callback_data: "cancel" }]]
        );
      }
      return new Response("OK");
    }
  }

  const isAddGuided = lower === "/add" || lower === "➕ add";
  const isTodayShortcut = lower === "📋 today";
  const isOverdueShortcut = lower === "⚠️ overdue";

  if (isAddGuided) {
    await showBucketPicker(botToken, chatIdStr, await getUserBuckets(userId));
    return new Response("OK");
  }

  let commandReply: string | null = null;
  if (lower === "/help") {
    commandReply = await buildHelpText(userId);
  } else if (lower === "/buckets") {
    commandReply = await cmdBuckets(userId);
  } else if (lower === "/list") {
    commandReply = await cmdList(userId, timezone);
  } else if (lower === "/due" || isTodayShortcut) {
    commandReply = await cmdDue(userId, timezone);
  } else if (lower === "/overdue" || isOverdueShortcut) {
    commandReply = await cmdOverdue(userId, timezone);
  } else if (lower.startsWith("/add ")) {
    commandReply = await cmdAddDirect(text.slice(5).trim(), userId, timezone);
  }

  if (commandReply !== null) {
    await sendTelegramWithQuickActions(botToken, chatIdStr, commandReply);
    return new Response("OK");
  }

  const [user, userBucketsFull] = await Promise.all([
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
      .where(eq(buckets.userId, userId)),
  ]);

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
  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, session.id))
    .orderBy(desc(chatMessages.createdAt))
    .limit(Math.max(10, Math.floor(threshold / 4)));
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

  const agentMessages: AgentMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(
        row,
        userBucketsFull,
        user?.email ?? "",
        new Date(),
        upcomingItems
      ),
    },
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

  void sendChatAction(botToken, chatIdStr, "typing");
  const typingInterval = setInterval(() => {
    void sendChatAction(botToken, chatIdStr, "typing");
  }, 4_000);

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
        agentMessages.push({
          role: "tool",
          toolCallId: call.id,
          toolName: call.name,
          content: await executeToolCall(call, userId, timezone),
        });
      }
    }
    if (!finalText) finalText = lastAssistantContent;
  } catch (err) {
    clearInterval(typingInterval);
    process.stderr.write(`[telegram] AI error: ${errorMessage(err)}\n`);
    return new Response("OK");
  }

  clearInterval(typingInterval);
  if (!finalText) return new Response("OK");

  try {
    await sendTelegramWithQuickActions(botToken, chatIdStr, finalText);
  } catch (err) {
    process.stderr.write(`[telegram] send error: ${errorMessage(err)}\n`);
  }

  try {
    await db.insert(chatMessages).values([
      { sessionId: session.id, userId, role: "user", content: text },
      { sessionId: session.id, userId, role: "assistant", content: finalText },
    ]);
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, session.id));
    void compactSessionIfNeeded(session.id, provider, threshold);
  } catch (err) {
    process.stderr.write(`[telegram] DB error: ${errorMessage(err)}\n`);
  }

  dataEvents.emit("refresh", userId);
  return new Response("OK");
}
