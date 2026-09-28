import { bucketReminderButtons } from "@/lib/rules";
import { formatSlot, formatWhen } from "@/lib/format-date";
import { isClosedStatus } from "@/constants";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { dataEvents } from "@/lib/events";
import { RESCHEDULE_DAY_LABELS } from "@/lib/notifications/constants";
import {
  editTelegramHtml,
  reminderButtons,
  removeMessageButtons,
  type InlineButton,
} from "@/lib/notifications/telegram";
import { escapeHtml, itemAlertHtml, itemMovedHtml } from "@/lib/notifications/telegram-message";
import {
  addLocalDays,
  endOfMonthDateString,
  localDateString,
  localDateTimeToDate,
  localDateToDate,
  toLocal,
} from "@/lib/reminders/zoned";
import {
  getBucketTelegramConfig,
  parseTimeStringExtended,
  setFlowState,
  updateItemDeadline,
  type RescheduleState,
} from "./telegram-utils";
import { buildCalendarRows, showItemActionMenu } from "./telegram-manage";

type Ctx = { botToken: string; chatId: string; userId: number; timezone: string };

type Item = {
  id: number;
  title: string;
  deadline: Date | null;
  bucketId: number;
  bucketName: string;
  rules: string;
};

const CANCEL: InlineButton = { text: "✖ Cancel", callback_data: "rx" };
const BACK: InlineButton = { text: "◀ Back", callback_data: "rb" };

async function loadItem(ctx: Ctx, itemId: number): Promise<Item | null> {
  const [row] = await db
    .select({
      id: items.id,
      title: items.title,
      deadline: items.deadline,
      bucketId: items.bucketId,
      bucketName: buckets.name,
      rules: buckets.notificationsRules,
      status: items.status,
      deletedAt: items.deletedAt,
    })
    .from(items)
    .innerJoin(buckets, eq(buckets.id, items.bucketId))
    .where(and(eq(items.id, itemId), eq(items.userId, ctx.userId)))
    .limit(1);
  return row && !row.deletedAt && !isClosedStatus(row.status) ? row : null;
}

function heading(item: Item, now: Date, timezone: string): string {
  if (!item.deadline) return `🕐 <b>${escapeHtml(item.title)}</b>\nno date yet`;
  return itemAlertHtml(
    {
      kind: "reminder",
      title: item.title,
      deadline: item.deadline,
      bucketName: item.bucketName,
      note: null,
    },
    now,
    timezone
  );
}

function pairs(buttons: InlineButton[], size: number): InlineButton[][] {
  const rows: InlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += size) rows.push(buttons.slice(i, i + size));
  return rows;
}

async function showDays(ctx: Ctx, item: Item, messageId: number, now: Date): Promise<void> {
  const config = await getBucketTelegramConfig(item.bucketId);
  const days = config.deadlinePresets.flatMap((p) =>
    p in RESCHEDULE_DAY_LABELS
      ? [
          {
            text: RESCHEDULE_DAY_LABELS[p as keyof typeof RESCHEDULE_DAY_LABELS],
            callback_data: `rd:${p}`,
          },
        ]
      : []
  );
  await editTelegramHtml(
    ctx.botToken,
    ctx.chatId,
    messageId,
    `${heading(item, now, ctx.timezone)}\n\nWhen?`,
    [
      ...pairs(days, 2),
      [{ text: "📅 Pick a date", callback_data: "rd:pick" }],
      [{ text: "🕐 Same day, new time", callback_data: "rd:same" }],
      [CANCEL],
    ]
  );
}

async function showTimes(ctx: Ctx, item: Item, date: string, messageId: number, now: Date) {
  const config = await getBucketTelegramConfig(item.bucketId);
  const isToday = date === localDateString(now, ctx.timezone);
  const current = toLocal(now, ctx.timezone);
  const stillAhead = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return !isToday || (h ?? 0) * 60 + (m ?? 0) > current.hour * 60 + current.minute;
  };

  const rows: InlineButton[][] = [];
  if (item.deadline) {
    const kept = toLocal(item.deadline, ctx.timezone);
    const keptHhmm = `${String(kept.hour).padStart(2, "0")}:${String(kept.minute).padStart(2, "0")}`;
    const allDay = kept.hour === 0 && kept.minute === 0;
    if (stillAhead(keptHhmm)) {
      rows.push([
        {
          text: allDay ? "Keep: all day" : `Keep ${formatSlot(keptHhmm)}`,
          callback_data: `rt:${keptHhmm}`,
        },
      ]);
    }
  }
  const slots = [...config.timeSlots].sort().filter(stillAhead);
  rows.push(
    ...pairs(
      slots.map((s) => ({ text: formatSlot(s), callback_data: `rt:${s}` })),
      3
    )
  );
  rows.push([{ text: "⌨ Type a time", callback_data: "rt:type" }]);
  rows.push([BACK, CANCEL]);

  await editTelegramHtml(
    ctx.botToken,
    ctx.chatId,
    messageId,
    `${heading(item, now, ctx.timezone)}\n\n→ ${formatWhen(localDateToDate(date, ctx.timezone), now, ctx.timezone)}\nWhat time?`,
    rows
  );
}

async function finish(ctx: Ctx, item: Item, deadline: Date, messageId: number, now: Date) {
  await updateItemDeadline(ctx.userId, item.id, deadline);
  await setFlowState(ctx.userId, null);
  dataEvents.emit("refresh", ctx.userId);
  await editTelegramHtml(
    ctx.botToken,
    ctx.chatId,
    messageId,
    itemMovedHtml(item.title, deadline, now, ctx.timezone)
  );
}

async function applyTime(
  ctx: Ctx,
  item: Item,
  state: RescheduleState,
  hour: number,
  minute: number,
  messageId: number,
  now: Date
): Promise<void> {
  if (!state.date) return;
  const deadline = localDateTimeToDate(state.date, hour, minute, ctx.timezone);
  if (deadline <= now) {
    await editTelegramHtml(
      ctx.botToken,
      ctx.chatId,
      messageId,
      `${heading(item, now, ctx.timezone)}\n\nThat time has already passed. Type a later time, e.g. 7:30pm:`,
      [[BACK, CANCEL]]
    );
    await setFlowState(ctx.userId, { ...state, typing: true, pending: undefined }, messageId);
    return;
  }
  await finish(ctx, item, deadline, messageId, now);
}

// Closes a reschedule the user walked away from; a reminder gets its own buttons back
export async function abandonReschedule(
  ctx: Ctx,
  state: RescheduleState,
  messageId: number
): Promise<void> {
  const item = state.origin === "reminder" ? await loadItem(ctx, state.itemId) : null;
  if (item) {
    await editTelegramHtml(
      ctx.botToken,
      ctx.chatId,
      messageId,
      heading(item, new Date(), ctx.timezone),
      reminderButtons(item.id, bucketReminderButtons(item.rules))
    );
  } else {
    await removeMessageButtons(ctx.botToken, ctx.chatId, messageId);
  }
}

export async function startReschedule(
  ctx: Ctx,
  itemId: number,
  origin: RescheduleState["origin"],
  messageId: number
): Promise<void> {
  const item = await loadItem(ctx, itemId);
  if (!item) {
    await editTelegramHtml(
      ctx.botToken,
      ctx.chatId,
      messageId,
      "this item is done or no longer exists"
    );
    return;
  }
  await showDays(ctx, item, messageId, new Date());
  await setFlowState(ctx.userId, { s: "rs", itemId, origin }, messageId);
}

export async function handleRescheduleCallback(
  ctx: Ctx,
  data: string,
  state: RescheduleState,
  messageId: number
): Promise<void> {
  const now = new Date();
  const item = await loadItem(ctx, state.itemId);
  if (!item) {
    await setFlowState(ctx.userId, null);
    await editTelegramHtml(
      ctx.botToken,
      ctx.chatId,
      messageId,
      "this item is done or no longer exists"
    );
    return;
  }

  if (data === "rx") {
    await setFlowState(ctx.userId, null);
    if (state.origin === "list") {
      const newMsgId = await showItemActionMenu(
        ctx.botToken,
        ctx.chatId,
        item,
        ctx.timezone,
        messageId
      );
      await setFlowState(
        ctx.userId,
        {
          s: "mg_edit",
          itemId: item.id,
          itemTitle: item.title,
          bucketId: item.bucketId,
          bucketName: item.bucketName,
        },
        newMsgId
      );
    } else {
      await editTelegramHtml(
        ctx.botToken,
        ctx.chatId,
        messageId,
        heading(item, now, ctx.timezone),
        reminderButtons(item.id, bucketReminderButtons(item.rules))
      );
    }
    return;
  }

  if (data === "rb") {
    await showDays(ctx, item, messageId, now);
    await setFlowState(ctx.userId, { s: "rs", itemId: item.id, origin: state.origin }, messageId);
    return;
  }

  if (data.startsWith("rd:")) {
    const choice = data.slice(3);
    if (choice === "pick") {
      const month = localDateString(now, ctx.timezone).slice(0, 7);
      await showCalendar(ctx, item, month, messageId, now);
      await setFlowState(ctx.userId, { ...state, month }, messageId);
      return;
    }
    const date =
      choice === "today"
        ? localDateString(now, ctx.timezone)
        : choice === "tomorrow"
          ? localDateString(addLocalDays(now, 1, ctx.timezone), ctx.timezone)
          : choice === "this_week"
            ? localDateString(addLocalDays(now, 7, ctx.timezone), ctx.timezone)
            : choice === "end_of_month"
              ? endOfMonthDateString(now, ctx.timezone)
              : localDateString(item.deadline ?? now, ctx.timezone);
    await showTimes(ctx, item, date, messageId, now);
    await setFlowState(ctx.userId, { ...state, date }, messageId);
    return;
  }

  if (data.startsWith("ec:")) {
    const month = data.slice(3);
    await showCalendar(ctx, item, month, messageId, now);
    await setFlowState(ctx.userId, { ...state, month }, messageId);
    return;
  }

  if (data.startsWith("ek:")) {
    const date = data.slice(3);
    await showTimes(ctx, item, date, messageId, now);
    await setFlowState(ctx.userId, { ...state, date }, messageId);
    return;
  }

  if (data === "rt:type") {
    await editTelegramHtml(
      ctx.botToken,
      ctx.chatId,
      messageId,
      `${heading(item, now, ctx.timezone)}\n\nType a time, e.g. 7:30pm or 19:30:`,
      [[BACK, CANCEL]]
    );
    await setFlowState(ctx.userId, { ...state, typing: true }, messageId);
    return;
  }

  if (data.startsWith("rt:")) {
    const [h, m] = data.slice(3).split(":").map(Number);
    await applyTime(ctx, item, state, h ?? 0, m ?? 0, messageId, now);
    return;
  }

  if (data.startsWith("ra:") && state.pending) {
    const pm = data === "ra:pm";
    const hour = (state.pending.hour % 12) + (pm ? 12 : 0);
    await applyTime(ctx, item, state, hour, state.pending.minute, messageId, now);
  }
}

async function showCalendar(ctx: Ctx, item: Item, month: string, messageId: number, now: Date) {
  await editTelegramHtml(
    ctx.botToken,
    ctx.chatId,
    messageId,
    `${heading(item, now, ctx.timezone)}\n\nPick a date:`,
    buildCalendarRows(month, [[BACK, CANCEL]])
  );
}

export async function handleRescheduleText(
  ctx: Ctx,
  text: string,
  state: RescheduleState,
  messageId: number
): Promise<void> {
  const now = new Date();
  const item = await loadItem(ctx, state.itemId);
  if (!item) {
    await setFlowState(ctx.userId, null);
    return;
  }
  const parsed = parseTimeStringExtended(text);
  if (!parsed) {
    await editTelegramHtml(
      ctx.botToken,
      ctx.chatId,
      messageId,
      `${heading(item, now, ctx.timezone)}\n\nCouldn't read "${escapeHtml(text)}". Try 7:30pm or 19:30:`,
      [[BACK, CANCEL]]
    );
    return;
  }
  if (parsed.ambiguous) {
    const shown = `${parsed.hour}:${String(parsed.minute).padStart(2, "0")}`;
    await editTelegramHtml(
      ctx.botToken,
      ctx.chatId,
      messageId,
      `${heading(item, now, ctx.timezone)}\n\n${shown}: AM or PM?`,
      [
        [
          { text: "AM", callback_data: "ra:am" },
          { text: "PM", callback_data: "ra:pm" },
        ],
        [BACK, CANCEL],
      ]
    );
    await setFlowState(
      ctx.userId,
      { ...state, typing: false, pending: { hour: parsed.hour, minute: parsed.minute } },
      messageId
    );
    return;
  }
  await applyTime(ctx, item, state, parsed.hour, parsed.minute, messageId, now);
}
