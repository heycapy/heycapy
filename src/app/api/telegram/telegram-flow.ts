import {
  sendTelegram,
  sendTelegramWithQuickActions,
  sendOrEditButtons,
  removeMessageButtons,
} from "@/lib/notifications/telegram";
import type { InlineButton } from "@/lib/notifications/telegram";
import type {
  TelegramDeadlinePreset,
  TelegramRecurringDefault,
} from "@/components/buckets/constants";
import { dataEvents } from "@/lib/events";
import {
  getBucketTelegramConfig,
  setFlowState,
  createItem,
  getCurrentTimeInTz,
  formatSlot,
  fmtDate,
  fmtDateTime,
} from "./telegram-utils";
import type { FlowState } from "./telegram-utils";

const PRESET_LABELS: Record<TelegramDeadlinePreset, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
  end_of_month: "End of month",
  pick_date: "Pick date…",
  no_deadline: "No deadline",
};

export async function showBucketPicker(
  botToken: string,
  chatId: string,
  buckets: { id: number; name: string; icon: string | null }[],
  messageId?: number | null
): Promise<number> {
  if (buckets.length === 0) {
    await sendTelegram(botToken, chatId, "No buckets yet. Create one in the app first.");
    return 0;
  }
  const buttonRows: InlineButton[][] = buckets.map((b) => [
    {
      text: `${b.icon ? b.icon + " " : ""}${b.name}`,
      callback_data: `ab:${b.id}:${b.name.slice(0, 20)}`,
    },
  ]);
  buttonRows.push([{ text: "✖ Cancel", callback_data: "cancel" }]);
  return sendOrEditButtons(botToken, chatId, messageId, "Which bucket?", buttonRows);
}

export async function showDeadlinePicker(
  botToken: string,
  chatId: string,
  state: { bucketId: number; bucketName: string; title: string },
  messageId?: number | null
): Promise<number> {
  const config = await getBucketTelegramConfig(state.bucketId);
  const buttons: InlineButton[] = config.deadlinePresets.map((p) => ({
    text: PRESET_LABELS[p],
    callback_data: `ad:${p}`,
  }));
  const rows: InlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    const row: InlineButton[] = [buttons[i]];
    if (buttons[i + 1]) row.push(buttons[i + 1]);
    rows.push(row);
  }
  rows.push([{ text: "✖ Cancel", callback_data: "cancel" }]);
  return sendOrEditButtons(
    botToken,
    chatId,
    messageId,
    `"${state.title}" → ${state.bucketName}\n\nWhen is it due?`,
    rows
  );
}

export async function showTimePicker(
  botToken: string,
  chatId: string,
  state: { bucketName: string; title: string },
  timezone: string,
  isToday: boolean,
  slots: string[],
  messageId?: number | null
): Promise<number> {
  const sorted = [...slots].sort();
  const filtered = isToday
    ? (() => {
        const { hour: nowH, minute: nowM } = getCurrentTimeInTz(timezone);
        return sorted.filter((s) => {
          const [hStr, mStr] = s.split(":");
          const h = parseInt(hStr ?? "0");
          const m = parseInt(mStr ?? "0");
          return h * 60 + m > nowH * 60 + nowM;
        });
      })()
    : sorted;
  const buttonRows: InlineButton[][] = [];
  for (let i = 0; i < filtered.length; i += 2) {
    const row: InlineButton[] = [
      { text: formatSlot(filtered[i] ?? ""), callback_data: `at:${filtered[i]}` },
    ];
    if (filtered[i + 1] !== undefined)
      row.push({ text: formatSlot(filtered[i + 1] ?? ""), callback_data: `at:${filtered[i + 1]}` });
    buttonRows.push(row);
  }
  buttonRows.push([
    { text: "No time", callback_data: "at:none" },
    { text: "Custom…", callback_data: "at:custom" },
  ]);
  buttonRows.push([{ text: "✖ Cancel", callback_data: "cancel" }]);
  const when = isToday ? "today" : "tomorrow";
  return sendOrEditButtons(
    botToken,
    chatId,
    messageId,
    `"${state.title}" → ${state.bucketName} (${when})\n\nWhat time?`,
    buttonRows
  );
}

export function buildCalendarRows(monthStr: string): InlineButton[][] {
  const [yearStr, monthPart] = monthStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthPart);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const prevY = month === 1 ? year - 1 : year;
  const prevM = month === 1 ? 12 : month - 1;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const rows: InlineButton[][] = [
    [
      { text: "◀", callback_data: `cm:${prevY}-${String(prevM).padStart(2, "0")}` },
      { text: `${MONTH_NAMES[month - 1]} ${year}`, callback_data: "_" },
      { text: "▶", callback_data: `cm:${nextY}-${String(nextM).padStart(2, "0")}` },
    ],
    ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => ({ text: d, callback_data: "_" })),
  ];
  let day = 1;
  let week: InlineButton[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) week.push({ text: " ", callback_data: "_" });
  while (day <= daysInMonth) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    week.push({ text: String(day), callback_data: `cd:${dateStr}` });
    if (week.length === 7) {
      rows.push(week);
      week = [];
    }
    day++;
  }
  while (week.length > 0 && week.length < 7) week.push({ text: " ", callback_data: "_" });
  if (week.length > 0) rows.push(week);
  rows.push([{ text: "✖ Cancel", callback_data: "cancel" }]);
  return rows;
}

export async function showCalendar(
  botToken: string,
  chatId: string,
  monthStr: string,
  title: string,
  bucketName: string,
  messageId?: number | null
): Promise<number> {
  return sendOrEditButtons(
    botToken,
    chatId,
    messageId,
    `"${title}" → ${bucketName}\n\nPick a date:`,
    buildCalendarRows(monthStr)
  );
}

export async function showRecurringPicker(
  botToken: string,
  chatId: string,
  state: { bucketName: string; title: string },
  defaultRecurring: TelegramRecurringDefault,
  messageId?: number | null
): Promise<number> {
  const mark = (f: TelegramRecurringDefault) => (f === defaultRecurring ? "✓ " : "");
  return sendOrEditButtons(
    botToken,
    chatId,
    messageId,
    `"${state.title}" → ${state.bucketName}\n\nRepeats?`,
    [
      [
        { text: `${mark("none")}Never`, callback_data: "rp:none" },
        { text: `${mark("daily")}Daily`, callback_data: "rp:daily" },
      ],
      [
        { text: `${mark("weekly")}Weekly`, callback_data: "rp:weekly" },
        { text: `${mark("monthly")}Monthly`, callback_data: "rp:monthly" },
      ],
      [{ text: `${mark("yearly")}Yearly`, callback_data: "rp:yearly" }],
      [{ text: "✖ Cancel", callback_data: "cancel" }],
    ]
  );
}

export async function handleAfterTime(
  botToken: string,
  chatId: string,
  userId: number,
  state: { bucketId: number; bucketName: string; title: string },
  deadline: Date,
  timezone: string,
  messageId?: number | null
): Promise<void> {
  const config = await getBucketTelegramConfig(state.bucketId);
  if (config.showRecurring) {
    const newMsgId = await showRecurringPicker(
      botToken,
      chatId,
      state,
      config.defaultRecurring,
      messageId
    );
    await setFlowState(
      userId,
      {
        s: "repeat",
        bucketId: state.bucketId,
        bucketName: state.bucketName,
        title: state.title,
        deadline: deadline.toISOString(),
      },
      newMsgId
    );
  } else {
    if (messageId) await removeMessageButtons(botToken, chatId, messageId);
    await createItem(userId, state.bucketId, state.title, deadline);
    await setFlowState(userId, null);
    dataEvents.emit("refresh", userId);
    await sendTelegramWithQuickActions(
      botToken,
      chatId,
      `Added "${state.title}" to ${state.bucketName} (${fmtDateTime(deadline, timezone)}) ✓`
    );
  }
}

export async function handleAfterDeadline(
  botToken: string,
  chatId: string,
  userId: number,
  state: { bucketId: number; bucketName: string; title: string },
  deadline: Date | null,
  timezone: string,
  messageId?: number | null
): Promise<void> {
  const config = await getBucketTelegramConfig(state.bucketId);
  if (config.showRecurring) {
    const newMsgId = await showRecurringPicker(
      botToken,
      chatId,
      state,
      config.defaultRecurring,
      messageId
    );
    await setFlowState(
      userId,
      {
        s: "repeat",
        bucketId: state.bucketId,
        bucketName: state.bucketName,
        title: state.title,
        deadline: deadline ? deadline.toISOString() : null,
      },
      newMsgId
    );
  } else {
    if (messageId) await removeMessageButtons(botToken, chatId, messageId);
    await createItem(userId, state.bucketId, state.title, deadline);
    await setFlowState(userId, null);
    const note = deadline ? ` (due ${fmtDate(deadline, timezone)})` : "";
    dataEvents.emit("refresh", userId);
    await sendTelegramWithQuickActions(
      botToken,
      chatId,
      `Added "${state.title}" to ${state.bucketName}${note} ✓`
    );
  }
}

export async function handleRepeatCallback(
  botToken: string,
  chatId: string,
  userId: number,
  state: Extract<FlowState, { s: "repeat" }>,
  freq: TelegramRecurringDefault,
  timezone: string,
  messageId?: number | null
): Promise<void> {
  const deadline = state.deadline ? new Date(state.deadline) : null;
  const recurring =
    freq === "none"
      ? null
      : JSON.stringify({ enabled: true, frequency: freq, interval: 1, endDate: null });
  if (messageId) await removeMessageButtons(botToken, chatId, messageId);
  await createItem(userId, state.bucketId, state.title, deadline, recurring);
  await setFlowState(userId, null);
  dataEvents.emit("refresh", userId);
  const dateNote = deadline ? ` (due ${fmtDate(deadline, timezone)})` : "";
  const recurNote = freq === "none" ? "" : `, repeats ${freq}`;
  await sendTelegramWithQuickActions(
    botToken,
    chatId,
    `Added "${state.title}" to ${state.bucketName}${dateNote}${recurNote} ✓`
  );
}
