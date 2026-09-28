import { completeItem } from "@/lib/reminders/quick-actions";
import { recordSystemError } from "@/lib/system-errors";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, chatMessages, chatSessions, users } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";
import { decryptValue } from "@/lib/crypto";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { CAPY_TOOLS, executeToolCall, getUpcomingItems } from "@/lib/ai/capyTools";
import {
  sendTelegram,
  sendTelegramWithQuickActions,
  sendOrEditButtons,
  removeMessageButtons,
  answerCallbackQuery,
  sendChatAction,
} from "@/lib/notifications/telegram";
import { compactSessionIfNeeded } from "@/lib/ai/compact";
import { dataEvents } from "@/lib/events";
import { errorMessage } from "@/lib/errors";
import { TELEGRAM_RESERVED_COMMANDS } from "@/constants";
import type { AgentMessage } from "@/lib/ai/types";
import type {
  TelegramDeadlinePreset,
  TelegramRecurringDefault,
} from "@/components/buckets/constants";
import {
  getFlowState,
  getFlowMessageId,
  setFlowState,
  getBucketTelegramConfig,
  getUserBuckets,
  parseTimeStringExtended,
  parseNaturalDeadline,
  updateItemTitle,
  softDeleteItemById,
} from "./telegram-utils";
import type { TelegramUpdate } from "./telegram-utils";
import { redeemTelegramLinkCode } from "@/lib/notifications/telegram-link";
import { isTelegramWebhookSecret } from "@/lib/notifications/telegram-webhook";
import { handleReminderAction } from "./telegram-quick-actions";
import {
  endOfMonthDateString,
  localDateString,
  localDateTimeToDate,
  localDateToDate,
} from "@/lib/reminders/zoned";
import { parseListKind, showItemListPage } from "./telegram-lists";
import {
  abandonReschedule,
  handleRescheduleCallback,
  handleRescheduleText,
  startReschedule,
} from "./telegram-reschedule";
import { TELEGRAM_KEYBOARD } from "@/lib/notifications/constants";
import {
  showBucketPicker,
  showDeadlinePicker,
  showTimePicker,
  showCalendar,
  handleAfterTime,
  handleAfterDeadline,
  handleRepeatCallback,
} from "./telegram-flow";
import { showListBucketPicker, showItemActionMenu, showDeleteConfirm } from "./telegram-manage";
import { cmdBuckets, cmdAddDirect, buildHelpText } from "./telegram-commands";

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return new Response("Not configured", { status: 503 });

  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!isTelegramWebhookSecret(botToken, secret)) {
    return new Response("Forbidden", { status: 403 });
  }

  let body: TelegramUpdate;
  try {
    body = (await req.json()) as TelegramUpdate;
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  // A failed update would be retried by Telegram and hold back every update after it
  try {
    return await handleUpdate(botToken, body);
  } catch (err) {
    recordSystemError("telegram", `update failed: ${errorMessage(err)}`, {
      err,
      context: describeUpdate(body),
    });
    return new Response("OK");
  }
}

// Enough to reproduce a failure without storing what the user typed
function describeUpdate(body: TelegramUpdate): Record<string, unknown> {
  const text = body.message?.text?.trim();
  return {
    kind: body.callback_query ? "button" : "message",
    button: body.callback_query?.data,
    command: text?.startsWith("/") ? text.split(/\s+/)[0] : text ? "(text)" : undefined,
    chatId: body.callback_query?.message?.chat?.id ?? body.message?.chat?.id,
    messageId: body.callback_query?.message?.message_id,
  };
}

async function handleUpdate(botToken: string, body: TelegramUpdate): Promise<Response> {
  const isCallback = !!body.callback_query;
  const chatId = isCallback ? body.callback_query?.message?.chat?.id : body.message?.chat?.id;
  const text = body.message?.text?.trim();
  const callbackData = body.callback_query?.data;
  const callbackQueryId = body.callback_query?.id;

  if (chatId === undefined) return new Response("OK");
  if (!isCallback && !text) return new Response("OK");
  const chatIdStr = String(chatId);

  if (callbackQueryId) await answerCallbackQuery(botToken, callbackQueryId).catch(() => {});

  if (text === "/start" || text?.startsWith("/start ")) {
    const code = text.slice("/start".length).trim();
    const linkedUserId = code ? redeemTelegramLinkCode(code, chatIdStr) : null;
    if (linkedUserId !== null) {
      dataEvents.emit("refresh", linkedUserId);
      await sendTelegramWithQuickActions(
        botToken,
        chatIdStr,
        "Connected to heycapy ✓\nYou can now chat with Capy and receive notifications here."
      );
      return new Response("OK");
    }
    const existing = await db.query.userSettings.findFirst({
      where: (s, { eq: qeq }) => qeq(s.telegramChatId, chatIdStr),
    });
    await sendTelegram(
      botToken,
      chatIdStr,
      existing
        ? "Already connected to heycapy ✓"
        : "To connect, open heycapy → tweaks → notifications → [connect], then tap the link there."
    );
    return new Response("OK");
  }

  const row = await db.query.userSettings.findFirst({
    where: (s, { eq: qeq }) => qeq(s.telegramChatId, chatIdStr),
  });
  if (!row) return new Response("OK");

  const userId = row.userId;
  const timezone = row.timezone ?? "UTC";
  let flowState = getFlowState(row.telegramState ?? null);
  const msgId = getFlowMessageId(row.telegramState ?? null);
  const ctx = { botToken, chatId: chatIdStr, userId, timezone };
  const tappedMsgId = body.callback_query?.message?.message_id;

  if (isCallback && callbackData) {
    if (callbackData === "_") return new Response("OK");

    if (callbackData === "cancel") {
      if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
      await setFlowState(userId, null);
      await sendTelegramWithQuickActions(botToken, chatIdStr, "Cancelled.");
      return new Response("OK");
    }

    if (callbackData.startsWith("ab:")) {
      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq, and: qand }) =>
          qand(qeq(b.id, Number(callbackData.slice(3).split(":")[0])), qeq(b.userId, userId)),
      });
      if (!bucket) return new Response("OK");
      const bucketId = bucket.id;
      const bucketName = bucket.name;
      const newMsgId = await sendOrEditButtons(
        botToken,
        chatIdStr,
        msgId,
        `Adding to ${bucketName}.\n\nWhat's the title?`,
        [[{ text: "✖ Cancel", callback_data: "cancel" }]]
      );
      await setFlowState(userId, { s: "title", bucketId, bucketName }, newMsgId);
      return new Response("OK");
    }

    if (callbackData.startsWith("ad:") && flowState?.s === "deadline") {
      const preset = callbackData.slice(3) as TelegramDeadlinePreset;

      if (preset === "today" || preset === "tomorrow") {
        const offset = preset === "today" ? 0 : 1;
        const dateStr = localDateString(new Date(Date.now() + offset * 86_400_000), timezone);
        const presetConfig = await getBucketTelegramConfig(flowState.bucketId);
        const newMsgId = await showTimePicker(
          botToken,
          chatIdStr,
          flowState,
          timezone,
          preset === "today",
          presetConfig.timeSlots,
          msgId
        );
        await setFlowState(
          userId,
          {
            s: "time",
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
            title: flowState.title,
            date: dateStr,
            isToday: preset === "today",
          },
          newMsgId
        );
        return new Response("OK");
      }

      if (preset === "end_of_month") {
        const dateStr = endOfMonthDateString(new Date(), timezone);
        const eomConfig = await getBucketTelegramConfig(flowState.bucketId);
        const newMsgId = await showTimePicker(
          botToken,
          chatIdStr,
          { ...flowState, bucketName: `${flowState.bucketName} (end of month)` },
          timezone,
          false,
          eomConfig.timeSlots,
          msgId
        );
        await setFlowState(
          userId,
          {
            s: "time",
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
            title: flowState.title,
            date: dateStr,
            isToday: false,
          },
          newMsgId
        );
        return new Response("OK");
      }

      if (preset === "pick_date") {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const newMsgId = await showCalendar(
          botToken,
          chatIdStr,
          monthStr,
          flowState.title,
          flowState.bucketName,
          msgId
        );
        await setFlowState(
          userId,
          {
            s: "cal",
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
            title: flowState.title,
            month: monthStr,
          },
          newMsgId
        );
        return new Response("OK");
      }

      const deadline = preset === "this_week" ? parseNaturalDeadline("next week", timezone) : null;
      await handleAfterDeadline(botToken, chatIdStr, userId, flowState, deadline, timezone, msgId);
      return new Response("OK");
    }

    if (callbackData.startsWith("cm:") && flowState?.s === "cal") {
      const newMonth = callbackData.slice(3);
      const newMsgId = await showCalendar(
        botToken,
        chatIdStr,
        newMonth,
        flowState.title,
        flowState.bucketName,
        msgId
      );
      await setFlowState(userId, { ...flowState, month: newMonth }, newMsgId);
      return new Response("OK");
    }

    if (callbackData.startsWith("cd:") && flowState?.s === "cal") {
      const dateStr = callbackData.slice(3);
      const today = localDateString(new Date(), timezone);
      const calConfig = await getBucketTelegramConfig(flowState.bucketId);
      const newMsgId = await showTimePicker(
        botToken,
        chatIdStr,
        flowState,
        timezone,
        dateStr === today,
        calConfig.timeSlots,
        msgId
      );
      await setFlowState(
        userId,
        {
          s: "time",
          bucketId: flowState.bucketId,
          bucketName: flowState.bucketName,
          title: flowState.title,
          date: dateStr,
          isToday: dateStr === today,
        },
        newMsgId
      );
      return new Response("OK");
    }

    if (callbackData.startsWith("at:") && flowState?.s === "time") {
      const when = callbackData.slice(3);
      if (when === "custom") {
        const newMsgId = await sendOrEditButtons(
          botToken,
          chatIdStr,
          msgId,
          "Type a time (e.g. 3pm, 15:30, 9am):",
          [[{ text: "✖ Cancel", callback_data: "cancel" }]]
        );
        await setFlowState(
          userId,
          {
            s: "ctime",
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
            title: flowState.title,
            date: flowState.date,
          },
          newMsgId
        );
        return new Response("OK");
      }
      let deadline: Date;
      if (when === "none") {
        deadline = localDateToDate(flowState.date, timezone);
      } else {
        const [hStr, mStr] = when.split(":");
        deadline = localDateTimeToDate(
          flowState.date,
          parseInt(hStr ?? "12"),
          parseInt(mStr ?? "0"),
          timezone
        );
      }
      await handleAfterTime(botToken, chatIdStr, userId, flowState, deadline, timezone, msgId);
      return new Response("OK");
    }

    if (callbackData.startsWith("rp:") && flowState?.s === "repeat") {
      const freq = callbackData.slice(3) as TelegramRecurringDefault;
      await handleRepeatCallback(botToken, chatIdStr, userId, flowState, freq, timezone, msgId);
      return new Response("OK");
    }

    // ── list / item management flow ──

    if (callbackData.startsWith("lb:")) {
      const bucketId = Number(callbackData.slice(3).split(":")[0]);
      const listMsgId = await showItemListPage(ctx, `b${bucketId}`, 0, tappedMsgId);
      await setFlowState(userId, null, listMsgId);
      return new Response("OK");
    }

    if (callbackData.startsWith("lp:")) {
      const [, rawKind, rawPage] = callbackData.split(":");
      const kind = parseListKind(rawKind ?? "");
      if (kind && tappedMsgId) {
        await showItemListPage(ctx, kind, Number(rawPage), tappedMsgId);
        await setFlowState(userId, null, tappedMsgId);
      }
      return new Response("OK");
    }

    if (callbackData === "lc") {
      if (tappedMsgId) await removeMessageButtons(botToken, chatIdStr, tappedMsgId);
      return new Response("OK");
    }

    if (callbackData.startsWith("mi:")) {
      const itemId = parseInt(callbackData.slice(3), 10);
      const itemRow = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!itemRow) {
        await setFlowState(userId, null);
        await sendTelegramWithQuickActions(botToken, chatIdStr, "Item not found.");
        return new Response("OK");
      }
      const bucketRow = await db.query.buckets.findFirst({
        where: (b, { eq: qeq }) => qeq(b.id, itemRow.bucketId),
      });
      const bucketId = itemRow.bucketId;
      const bucketName = bucketRow?.name ?? "Bucket";
      const menuMsgId = tappedMsgId ?? msgId;
      if (!menuMsgId) return new Response("OK");
      const newMsgId = await showItemActionMenu(
        botToken,
        chatIdStr,
        { title: itemRow.title, deadline: itemRow.deadline, bucketName },
        timezone,
        menuMsgId
      );
      await setFlowState(
        userId,
        {
          s: "mg_edit",
          itemId,
          itemTitle: itemRow.title,
          bucketId,
          bucketName,
        },
        newMsgId
      );
      return new Response("OK");
    }

    if (callbackData.startsWith("la:") && flowState?.s === "mg_edit") {
      const action = callbackData.slice(3);
      if (action === "complete") {
        if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
        await completeItem(userId, flowState.itemId);
        await setFlowState(userId, null);
        dataEvents.emit("refresh", userId);
        await sendTelegramWithQuickActions(
          botToken,
          chatIdStr,
          `✓ "${flowState.itemTitle}" marked as complete!`
        );
      } else if (action === "delete") {
        const newMsgId = await showDeleteConfirm(botToken, chatIdStr, flowState.itemTitle, msgId);
        await setFlowState(
          userId,
          {
            s: "mg_confirm",
            itemId: flowState.itemId,
            itemTitle: flowState.itemTitle,
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
          },
          newMsgId
        );
      }
      return new Response("OK");
    }

    if (flowState?.s === "rs" && /^(rd:|ec:|ek:|rt:|ra:|rb$|rx$)/.test(callbackData)) {
      // Only the message that started this reschedule can drive it
      if (msgId && body.callback_query?.message?.message_id === msgId) {
        await handleRescheduleCallback(ctx, callbackData, flowState, msgId);
      }
      return new Response("OK");
    }

    if (
      await handleReminderAction(callbackData, {
        botToken,
        chatId: chatIdStr,
        userId,
        timezone,
        alertMessageId: body.callback_query?.message?.message_id,
      })
    ) {
      return new Response("OK");
    }

    if (callbackData === "dc:yes" && flowState?.s === "mg_confirm") {
      if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
      await softDeleteItemById(userId, flowState.itemId);
      await setFlowState(userId, null);
      dataEvents.emit("refresh", userId);
      await sendTelegramWithQuickActions(
        botToken,
        chatIdStr,
        `🗑 "${flowState.itemTitle}" deleted.`
      );
      return new Response("OK");
    }

    if (callbackData.startsWith("me:") && flowState?.s === "mg_edit") {
      const what = callbackData.slice(3);
      if (what === "rename") {
        const newMsgId = await sendOrEditButtons(
          botToken,
          chatIdStr,
          msgId,
          `Type a new title for "${flowState.itemTitle}":`,
          [[{ text: "✖ Cancel", callback_data: "cancel" }]]
        );
        await setFlowState(
          userId,
          {
            s: "mg_edit_title",
            itemId: flowState.itemId,
            itemTitle: flowState.itemTitle,
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
          },
          newMsgId
        );
      } else if (what === "deadline" && msgId) {
        await startReschedule(ctx, flowState.itemId, "list", msgId);
      }
      return new Response("OK");
    }

    if (callbackData.startsWith("ap:") && flowState?.s === "ctime_ampm") {
      const period = callbackData.slice(3);
      let hour = flowState.hour;
      if (period === "pm" && hour !== 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;
      const deadline = localDateTimeToDate(flowState.date, hour, flowState.minute, timezone);
      await handleAfterTime(botToken, chatIdStr, userId, flowState, deadline, timezone, msgId);
      return new Response("OK");
    }

    return new Response("OK");
  }

  if (!text) return new Response("OK");

  // Commands and the keyboard buttons always win over a half-finished step
  const isCommand =
    text.startsWith("/") ||
    TELEGRAM_KEYBOARD.some((row) => (row as readonly string[]).includes(text));
  if (flowState && isCommand) {
    if (flowState.s === "rs" && msgId) await abandonReschedule(ctx, flowState, msgId);
    else if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
    await setFlowState(userId, null);
    flowState = null;
  }

  if (flowState?.s === "rs" && flowState.typing && msgId) {
    await handleRescheduleText(ctx, text, flowState, msgId);
    return new Response("OK");
  }

  if (flowState?.s === "title") {
    const title = text.trim();
    if (!title) {
      await sendTelegram(botToken, chatIdStr, "Title cannot be empty. Try again:");
      return new Response("OK");
    }
    const newMsgId = await showDeadlinePicker(
      botToken,
      chatIdStr,
      {
        bucketId: flowState.bucketId,
        bucketName: flowState.bucketName,
        title,
      },
      null
    );
    await setFlowState(
      userId,
      {
        s: "deadline",
        bucketId: flowState.bucketId,
        bucketName: flowState.bucketName,
        title,
      },
      newMsgId
    );
    return new Response("OK");
  }

  if (flowState?.s === "ctime" || flowState?.s === "time") {
    const parsed = parseTimeStringExtended(text);
    if (!parsed) {
      await sendOrEditButtons(
        botToken,
        chatIdStr,
        msgId,
        `Couldn't parse "${text}". Try "3pm", "15:30", or "9am":`,
        [[{ text: "✖ Cancel", callback_data: "cancel" }]]
      );
      return new Response("OK");
    }
    if (parsed.ambiguous) {
      const newMsgId = await sendOrEditButtons(
        botToken,
        chatIdStr,
        msgId,
        `${parsed.hour}:${String(parsed.minute).padStart(2, "0")} — AM or PM?`,
        [
          [
            { text: "AM", callback_data: "ap:am" },
            { text: "PM", callback_data: "ap:pm" },
          ],
          [{ text: "✖ Cancel", callback_data: "cancel" }],
        ]
      );
      await setFlowState(
        userId,
        {
          s: "ctime_ampm",
          bucketId: flowState.bucketId,
          bucketName: flowState.bucketName,
          title: flowState.title,
          date: flowState.date,
          hour: parsed.hour,
          minute: parsed.minute,
        },
        newMsgId
      );
      return new Response("OK");
    }
    const deadline = localDateTimeToDate(flowState.date, parsed.hour, parsed.minute, timezone);
    await handleAfterTime(botToken, chatIdStr, userId, flowState, deadline, timezone, msgId);
    return new Response("OK");
  }

  if (flowState?.s === "mg_edit_title") {
    const newTitle = text.trim();
    if (!newTitle) {
      await sendTelegram(botToken, chatIdStr, "Title cannot be empty. Try again:");
      return new Response("OK");
    }
    if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
    await updateItemTitle(userId, flowState.itemId, newTitle);
    await setFlowState(userId, null);
    dataEvents.emit("refresh", userId);
    await sendTelegramWithQuickActions(botToken, chatIdStr, `✓ Renamed to "${newTitle}"`);
    return new Response("OK");
  }

  if (flowState?.s === "ctime_ampm") {
    const newMsgId = await sendOrEditButtons(botToken, chatIdStr, msgId, "Please tap AM or PM:", [
      [
        { text: "AM", callback_data: "ap:am" },
        { text: "PM", callback_data: "ap:pm" },
      ],
      [{ text: "✖ Cancel", callback_data: "cancel" }],
    ]);
    await setFlowState(userId, flowState, newMsgId);
    return new Response("OK");
  }

  const lower = text.toLowerCase();

  const command = lower.startsWith("/") ? lower.slice(1).split(/\s+/)[0] : "";
  if (command && !(TELEGRAM_RESERVED_COMMANDS as readonly string[]).includes(command)) {
    const titlePart = text.slice(1 + command.length).trim();
    const allUserBuckets = await getUserBuckets(userId);
    let matchedBucket: (typeof allUserBuckets)[0] | undefined;
    for (const b of allUserBuckets) {
      const cfg = await getBucketTelegramConfig(b.id);
      if (cfg.alias === command) {
        matchedBucket = b;
        break;
      }
    }
    if (matchedBucket) {
      if (titlePart) {
        const newMsgId = await showDeadlinePicker(botToken, chatIdStr, {
          bucketId: matchedBucket.id,
          bucketName: matchedBucket.name,
          title: titlePart,
        });
        await setFlowState(
          userId,
          {
            s: "deadline",
            bucketId: matchedBucket.id,
            bucketName: matchedBucket.name,
            title: titlePart,
          },
          newMsgId
        );
      } else {
        const newMsgId = await sendOrEditButtons(
          botToken,
          chatIdStr,
          null,
          `Adding to ${matchedBucket.name}.\n\nWhat's the title?`,
          [[{ text: "✖ Cancel", callback_data: "cancel" }]]
        );
        await setFlowState(
          userId,
          {
            s: "title",
            bucketId: matchedBucket.id,
            bucketName: matchedBucket.name,
          },
          newMsgId
        );
      }
      return new Response("OK");
    }
  }

  const isAddGuided = lower === "/add" || lower === "➕ add";
  const isTodayShortcut = lower === "📋 today";
  const isOverdueShortcut = lower === "⚠️ overdue";
  const isListShortcut = lower === "📝 list" || lower === "/list_items";

  if (isAddGuided) {
    const userBuckets = await getUserBuckets(userId);
    const onlyBucket = userBuckets.length === 1 ? userBuckets[0] : null;
    if (onlyBucket) {
      const newMsgId = await sendOrEditButtons(
        botToken,
        chatIdStr,
        null,
        `Adding to ${onlyBucket.name}.\n\nWhat's the title?`,
        [[{ text: "✖ Cancel", callback_data: "cancel" }]]
      );
      await setFlowState(
        userId,
        { s: "title", bucketId: onlyBucket.id, bucketName: onlyBucket.name },
        newMsgId
      );
    } else {
      const newMsgId = await showBucketPicker(botToken, chatIdStr, userBuckets);
      await setFlowState(userId, null, newMsgId);
    }
    return new Response("OK");
  }

  if (isListShortcut) {
    const userBuckets = await getUserBuckets(userId);
    const onlyBucket = userBuckets.length === 1 ? userBuckets[0] : null;
    if (onlyBucket) {
      const listMsgId = await showItemListPage(ctx, `b${onlyBucket.id}`, 0);
      await setFlowState(userId, null, listMsgId);
    } else {
      const newMsgId = await showListBucketPicker(botToken, chatIdStr, userBuckets);
      await setFlowState(userId, null, newMsgId);
    }
    return new Response("OK");
  }

  if (lower === "/help") {
    await sendTelegramWithQuickActions(botToken, chatIdStr, await buildHelpText(userId));
    return new Response("OK");
  }
  if (lower === "/buckets") {
    const newMsgId = await cmdBuckets(botToken, chatIdStr, userId);
    await setFlowState(userId, null, newMsgId);
    return new Response("OK");
  }
  if (lower === "/list") {
    const listMsgId = await showItemListPage(ctx, "up", 0);
    await setFlowState(userId, null, listMsgId);
    return new Response("OK");
  }
  if (lower === "/due" || isTodayShortcut) {
    const listMsgId = await showItemListPage(ctx, "td", 0);
    await setFlowState(userId, null, listMsgId);
    return new Response("OK");
  }
  if (lower === "/overdue" || isOverdueShortcut) {
    const listMsgId = await showItemListPage(ctx, "od", 0);
    await setFlowState(userId, null, listMsgId);
    return new Response("OK");
  }
  if (lower.startsWith("/add ")) {
    await sendTelegramWithQuickActions(
      botToken,
      chatIdStr,
      await cmdAddDirect(text.slice(5).trim(), userId, timezone)
    );
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
    recordSystemError("telegram", `saving chat failed: ${errorMessage(err)}`, {
      userId,
      err,
      context: { chatSessionId: session.id },
    });
  }

  dataEvents.emit("refresh", userId);
  return new Response("OK");
}
