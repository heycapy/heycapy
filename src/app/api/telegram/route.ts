import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, chatMessages, chatSessions, userSettings, users } from "@/lib/db/schema";
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
  editTelegramHtml,
  sendChatAction,
} from "@/lib/notifications/telegram";
import { compactSessionIfNeeded } from "@/lib/ai/compact";
import { dataEvents } from "@/lib/events";
import { itemDoneHtml } from "@/lib/notifications/telegram-message";
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
  getLocalDateStr,
  getEndOfMonthDateStr,
  getUserBuckets,
  applyTimeToDate,
  parseTimeStringExtended,
  parseNaturalDeadline,
  fmtDate,
  fmtDateTime,
  completeItemById,
  updateItemTitle,
  updateItemDeadline,
  softDeleteItemById,
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
  showListBucketPicker,
  showItemList,
  showItemActionMenu,
  showDeleteConfirm,
  showEditDeadlinePicker,
  showEditTimePicker,
  showEditCalendar,
} from "./telegram-manage";
import {
  cmdBuckets,
  cmdList,
  cmdDue,
  cmdOverdue,
  cmdAddDirect,
  buildHelpText,
} from "./telegram-commands";

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
  const msgId = getFlowMessageId(row.telegramState ?? null);

  if (isCallback && callbackData) {
    if (callbackData === "_") return new Response("OK");

    if (callbackData === "cancel") {
      if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
      await setFlowState(userId, null);
      await sendTelegramWithQuickActions(botToken, chatIdStr, "Cancelled.");
      return new Response("OK");
    }

    if (callbackData.startsWith("ab:")) {
      const parts = callbackData.slice(3).split(":");
      const bucketId = Number(parts[0]);
      const bucketName = parts.slice(1).join(":") || "Bucket";
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
        const dateStr = getLocalDateStr(new Date(Date.now() + offset * 86_400_000), timezone);
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
        const dateStr = getEndOfMonthDateStr(timezone);
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
      const today = getLocalDateStr(new Date(), timezone);
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
        deadline = applyTimeToDate(flowState.date, 12, 0, timezone);
      } else {
        const [hStr, mStr] = when.split(":");
        deadline = applyTimeToDate(
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
      const parts = callbackData.slice(3).split(":");
      const bucketId = Number(parts[0]);
      const bucketName = parts.slice(1).join(":") || "Bucket";
      const newMsgId = await showItemList(
        botToken,
        chatIdStr,
        userId,
        bucketId,
        bucketName,
        0,
        timezone,
        msgId
      );
      await setFlowState(userId, { s: "lb_items", bucketId, bucketName, page: 0 }, newMsgId);
      return new Response("OK");
    }

    if (callbackData.startsWith("mp:") && flowState?.s === "lb_items") {
      const page = parseInt(callbackData.slice(3), 10);
      const newMsgId = await showItemList(
        botToken,
        chatIdStr,
        userId,
        flowState.bucketId,
        flowState.bucketName,
        page,
        timezone,
        msgId
      );
      await setFlowState(userId, { ...flowState, page }, newMsgId);
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
      const newMsgId = await showItemActionMenu(botToken, chatIdStr, itemRow.title, msgId);
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
        await completeItemById(userId, flowState.itemId);
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

    // ── quick actions from notifications ──

    if (callbackData.startsWith("qc:")) {
      const itemId = parseInt(callbackData.slice(3), 10);
      const found = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      const item = found && !found.deletedAt ? found : null;
      const alreadyDone = item?.status === "completed";
      if (item && !alreadyDone) {
        await completeItemById(userId, itemId);
        dataEvents.emit("refresh", userId);
      }
      const alertMessageId = body.callback_query?.message?.message_id;
      if (alertMessageId) {
        await editTelegramHtml(
          botToken,
          chatIdStr,
          alertMessageId,
          item ? itemDoneHtml(item.title, alreadyDone) : "this item no longer exists"
        );
      }
      return new Response("OK");
    }

    if (callbackData.startsWith("qu:")) {
      const itemId = parseInt(callbackData.slice(3), 10);
      const itemRow = await db.query.items.findFirst({
        where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, userId)),
      });
      if (!itemRow) return new Response("OK");
      const bucket = await db.query.buckets.findFirst({
        where: (b, { eq: qeq }) => qeq(b.id, itemRow.bucketId),
      });
      const newMsgId = await showEditDeadlinePicker(
        botToken,
        chatIdStr,
        itemRow.title,
        itemRow.bucketId,
        msgId
      );
      await setFlowState(
        userId,
        {
          s: "mg_edit_dl",
          itemId,
          itemTitle: itemRow.title,
          bucketId: itemRow.bucketId,
          bucketName: bucket?.name ?? "Bucket",
        },
        newMsgId
      );
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
          `Type a new title for "${flowState.itemTitle.slice(0, 40)}":`,
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
      } else if (what === "deadline") {
        const newMsgId = await showEditDeadlinePicker(
          botToken,
          chatIdStr,
          flowState.itemTitle,
          flowState.bucketId,
          msgId
        );
        await setFlowState(
          userId,
          {
            s: "mg_edit_dl",
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

    if (callbackData.startsWith("eq:") && flowState?.s === "mg_edit_dl") {
      const preset = callbackData.slice(3) as TelegramDeadlinePreset;
      if (preset === "no_deadline") {
        if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
        await updateItemDeadline(userId, flowState.itemId, null);
        await setFlowState(userId, null);
        dataEvents.emit("refresh", userId);
        await sendTelegramWithQuickActions(
          botToken,
          chatIdStr,
          `Updated "${flowState.itemTitle}" — deadline removed ✓`
        );
      } else if (preset === "today" || preset === "tomorrow") {
        const offset = preset === "today" ? 0 : 1;
        const dateStr = getLocalDateStr(new Date(Date.now() + offset * 86_400_000), timezone);
        const newMsgId = await showEditTimePicker(
          botToken,
          chatIdStr,
          flowState.itemTitle,
          flowState.bucketId,
          timezone,
          preset === "today",
          msgId
        );
        await setFlowState(
          userId,
          {
            s: "mg_edit_time",
            itemId: flowState.itemId,
            itemTitle: flowState.itemTitle,
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
            date: dateStr,
            isToday: preset === "today",
          },
          newMsgId
        );
      } else if (preset === "end_of_month") {
        const dateStr = getEndOfMonthDateStr(timezone);
        const newMsgId = await showEditTimePicker(
          botToken,
          chatIdStr,
          flowState.itemTitle,
          flowState.bucketId,
          timezone,
          false,
          msgId
        );
        await setFlowState(
          userId,
          {
            s: "mg_edit_time",
            itemId: flowState.itemId,
            itemTitle: flowState.itemTitle,
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
            date: dateStr,
            isToday: false,
          },
          newMsgId
        );
      } else if (preset === "pick_date") {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const newMsgId = await showEditCalendar(
          botToken,
          chatIdStr,
          monthStr,
          flowState.itemTitle,
          msgId
        );
        await setFlowState(
          userId,
          {
            s: "mg_edit_cal",
            itemId: flowState.itemId,
            itemTitle: flowState.itemTitle,
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
            month: monthStr,
          },
          newMsgId
        );
      } else if (preset === "this_week") {
        const deadline = parseNaturalDeadline("next week", timezone);
        if (deadline) {
          if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
          await updateItemDeadline(userId, flowState.itemId, deadline);
          dataEvents.emit("refresh", userId);
          await sendTelegramWithQuickActions(
            botToken,
            chatIdStr,
            `Updated "${flowState.itemTitle}" — due ${fmtDate(deadline, timezone)} ✓`
          );
        }
        await setFlowState(userId, null);
      }
      return new Response("OK");
    }

    if (callbackData.startsWith("ec:") && flowState?.s === "mg_edit_cal") {
      const newMonth = callbackData.slice(3);
      const newMsgId = await showEditCalendar(
        botToken,
        chatIdStr,
        newMonth,
        flowState.itemTitle,
        msgId
      );
      await setFlowState(userId, { ...flowState, month: newMonth }, newMsgId);
      return new Response("OK");
    }

    if (callbackData.startsWith("ek:") && flowState?.s === "mg_edit_cal") {
      const dateStr = callbackData.slice(3);
      const today = getLocalDateStr(new Date(), timezone);
      const newMsgId = await showEditTimePicker(
        botToken,
        chatIdStr,
        flowState.itemTitle,
        flowState.bucketId,
        timezone,
        dateStr === today,
        msgId
      );
      await setFlowState(
        userId,
        {
          s: "mg_edit_time",
          itemId: flowState.itemId,
          itemTitle: flowState.itemTitle,
          bucketId: flowState.bucketId,
          bucketName: flowState.bucketName,
          date: dateStr,
          isToday: dateStr === today,
        },
        newMsgId
      );
      return new Response("OK");
    }

    if (callbackData.startsWith("et:") && flowState?.s === "mg_edit_time") {
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
            s: "mg_edit_ctime",
            itemId: flowState.itemId,
            itemTitle: flowState.itemTitle,
            bucketId: flowState.bucketId,
            bucketName: flowState.bucketName,
            date: flowState.date,
          },
          newMsgId
        );
        return new Response("OK");
      }
      const deadline =
        when === "none"
          ? applyTimeToDate(flowState.date, 12, 0, timezone)
          : applyTimeToDate(
              flowState.date,
              parseInt(when.split(":")[0] ?? "12"),
              parseInt(when.split(":")[1] ?? "0"),
              timezone
            );
      if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
      await updateItemDeadline(userId, flowState.itemId, deadline);
      await setFlowState(userId, null);
      dataEvents.emit("refresh", userId);
      await sendTelegramWithQuickActions(
        botToken,
        chatIdStr,
        `Updated "${flowState.itemTitle}" — due ${fmtDateTime(deadline, timezone)} ✓`
      );
      return new Response("OK");
    }

    if (
      callbackData.startsWith("ap:") &&
      (flowState?.s === "ctime_ampm" || flowState?.s === "mg_edit_ampm")
    ) {
      const period = callbackData.slice(3);
      let hour = flowState.hour;
      if (period === "pm" && hour !== 12) hour += 12;
      if (period === "am" && hour === 12) hour = 0;

      if (flowState.s === "ctime_ampm") {
        const deadline = applyTimeToDate(flowState.date, hour, flowState.minute, timezone);
        await handleAfterTime(botToken, chatIdStr, userId, flowState, deadline, timezone, msgId);
      } else {
        const deadline = applyTimeToDate(flowState.date, hour, flowState.minute, timezone);
        if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
        await updateItemDeadline(userId, flowState.itemId, deadline);
        await setFlowState(userId, null);
        dataEvents.emit("refresh", userId);
        await sendTelegramWithQuickActions(
          botToken,
          chatIdStr,
          `Updated "${flowState.itemTitle}" — due ${fmtDateTime(deadline, timezone)} ✓`
        );
      }
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
    const deadline = applyTimeToDate(flowState.date, parsed.hour, parsed.minute, timezone);
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

  if (flowState?.s === "mg_edit_ctime") {
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
          s: "mg_edit_ampm",
          itemId: flowState.itemId,
          itemTitle: flowState.itemTitle,
          bucketId: flowState.bucketId,
          bucketName: flowState.bucketName,
          date: flowState.date,
          hour: parsed.hour,
          minute: parsed.minute,
        },
        newMsgId
      );
      return new Response("OK");
    }
    const deadline = applyTimeToDate(flowState.date, parsed.hour, parsed.minute, timezone);
    if (msgId) await removeMessageButtons(botToken, chatIdStr, msgId);
    await updateItemDeadline(userId, flowState.itemId, deadline);
    await setFlowState(userId, null);
    dataEvents.emit("refresh", userId);
    await sendTelegramWithQuickActions(
      botToken,
      chatIdStr,
      `Updated "${flowState.itemTitle}" — due ${fmtDateTime(deadline, timezone)} ✓`
    );
    return new Response("OK");
  }

  if (flowState?.s === "ctime_ampm" || flowState?.s === "mg_edit_ampm") {
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
      const newMsgId = await showItemList(
        botToken,
        chatIdStr,
        userId,
        onlyBucket.id,
        onlyBucket.name,
        0,
        timezone,
        null
      );
      await setFlowState(
        userId,
        { s: "lb_items", bucketId: onlyBucket.id, bucketName: onlyBucket.name, page: 0 },
        newMsgId
      );
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
    const newMsgId = await cmdList(botToken, chatIdStr, userId, timezone);
    await setFlowState(userId, null, newMsgId);
    return new Response("OK");
  }
  if (lower === "/due" || isTodayShortcut) {
    const newMsgId = await cmdDue(botToken, chatIdStr, userId, timezone);
    await setFlowState(userId, null, newMsgId);
    return new Response("OK");
  }
  if (lower === "/overdue" || isOverdueShortcut) {
    const newMsgId = await cmdOverdue(botToken, chatIdStr, userId, timezone);
    await setFlowState(userId, null, newMsgId);
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
    process.stderr.write(`[telegram] DB error: ${errorMessage(err)}\n`);
  }

  dataEvents.emit("refresh", userId);
  return new Response("OK");
}
