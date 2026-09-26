import { sendTelegramWithQuickActions, sendOrEditButtons } from "@/lib/notifications/telegram";
import type { InlineButton } from "@/lib/notifications/telegram";
import type { TelegramDeadlinePreset } from "@/components/buckets/constants";
import {
  getActiveItemsForBucket,
  getBucketTelegramConfig,
  getCurrentTimeInTz,
  formatSlot,
  fmtDateTimeShort,
} from "./telegram-utils";

const ITEMS_PER_PAGE = 8;

const PRESET_LABELS: Record<TelegramDeadlinePreset, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "This week",
  end_of_month: "End of month",
  pick_date: "Pick date…",
  no_deadline: "No deadline",
};

export async function showListBucketPicker(
  botToken: string,
  chatId: string,
  buckets: { id: number; name: string; icon: string | null }[],
  messageId?: number | null
): Promise<number> {
  if (buckets.length === 0) {
    await sendTelegramWithQuickActions(
      botToken,
      chatId,
      "No buckets yet. Create one in the app first."
    );
    return 0;
  }
  const buttonRows: InlineButton[][] = buckets.map((b) => [
    {
      text: `${b.icon ? b.icon + " " : ""}${b.name}`,
      callback_data: `lb:${b.id}:${b.name.slice(0, 20)}`,
    },
  ]);
  buttonRows.push([{ text: "✖ Cancel", callback_data: "cancel" }]);
  return sendOrEditButtons(botToken, chatId, messageId, "Which bucket?", buttonRows);
}

export async function showItemList(
  botToken: string,
  chatId: string,
  userId: number,
  bucketId: number,
  bucketName: string,
  page: number,
  timezone: string,
  messageId?: number | null
): Promise<number> {
  const allItems = await getActiveItemsForBucket(userId, bucketId);
  if (allItems.length === 0) {
    return sendOrEditButtons(botToken, chatId, messageId, `No active items in ${bucketName}.`, [
      [{ text: "✖ Cancel", callback_data: "cancel" }],
    ]);
  }
  const totalPages = Math.ceil(allItems.length / ITEMS_PER_PAGE);
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const slice = allItems.slice(safePage * ITEMS_PER_PAGE, (safePage + 1) * ITEMS_PER_PAGE);
  const rows: InlineButton[][] = slice.map((item) => {
    const deadlineSuffix = item.deadline ? ` — ${fmtDateTimeShort(item.deadline, timezone)}` : "";
    const maxTitle = 60 - deadlineSuffix.length;
    const truncTitle =
      item.title.length > maxTitle ? item.title.slice(0, maxTitle - 1) + "…" : item.title;
    return [{ text: `${truncTitle}${deadlineSuffix}`, callback_data: `mi:${item.id}` }];
  });
  if (totalPages > 1) {
    const navRow: InlineButton[] = [];
    if (safePage > 0) navRow.push({ text: "◀ Prev", callback_data: `mp:${safePage - 1}` });
    navRow.push({ text: `${safePage + 1}/${totalPages}`, callback_data: "_" });
    if (safePage < totalPages - 1)
      navRow.push({ text: "Next ▶", callback_data: `mp:${safePage + 1}` });
    rows.push(navRow);
  }
  rows.push([{ text: "✖ Cancel", callback_data: "cancel" }]);
  return sendOrEditButtons(botToken, chatId, messageId, `${bucketName} — tap an item:`, rows);
}

export async function showItemActionMenu(
  botToken: string,
  chatId: string,
  itemTitle: string,
  messageId?: number | null
): Promise<number> {
  return sendOrEditButtons(botToken, chatId, messageId, `"${itemTitle.slice(0, 50)}"`, [
    [
      { text: "✓ Complete", callback_data: "la:complete" },
      { text: "✏️ Rename", callback_data: "me:rename" },
    ],
    [
      { text: "📅 Change deadline", callback_data: "me:deadline" },
      { text: "🗑 Delete", callback_data: "la:delete" },
    ],
    [{ text: "✖ Cancel", callback_data: "cancel" }],
  ]);
}

export async function showDeleteConfirm(
  botToken: string,
  chatId: string,
  itemTitle: string,
  messageId?: number | null
): Promise<number> {
  return sendOrEditButtons(botToken, chatId, messageId, `Delete "${itemTitle.slice(0, 40)}"?`, [
    [
      { text: "🗑 Yes, delete", callback_data: "dc:yes" },
      { text: "✖ No", callback_data: "cancel" },
    ],
  ]);
}

export async function showEditDeadlinePicker(
  botToken: string,
  chatId: string,
  itemTitle: string,
  bucketId: number,
  messageId?: number | null
): Promise<number> {
  const config = await getBucketTelegramConfig(bucketId);
  const presets = config.deadlinePresets.filter((p) => p !== "no_deadline");
  const buttons: InlineButton[] = presets.map((p) => ({
    text: PRESET_LABELS[p],
    callback_data: `eq:${p}`,
  }));
  const rows: InlineButton[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    const first = buttons[i];
    if (!first) continue;
    const row: InlineButton[] = [first];
    const second = buttons[i + 1];
    if (second) row.push(second);
    rows.push(row);
  }
  rows.push([{ text: "✕ Remove deadline", callback_data: "eq:no_deadline" }]);
  rows.push([{ text: "✖ Cancel", callback_data: "cancel" }]);
  return sendOrEditButtons(
    botToken,
    chatId,
    messageId,
    `"${itemTitle.slice(0, 40)}"\n\nNew deadline?`,
    rows
  );
}

export async function showEditTimePicker(
  botToken: string,
  chatId: string,
  itemTitle: string,
  bucketId: number,
  timezone: string,
  isToday: boolean,
  messageId?: number | null
): Promise<number> {
  const config = await getBucketTelegramConfig(bucketId);
  const sorted = [...config.timeSlots].sort();
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
  const rows: InlineButton[][] = [];
  for (let i = 0; i < filtered.length; i += 2) {
    const row: InlineButton[] = [
      { text: formatSlot(filtered[i] ?? ""), callback_data: `et:${filtered[i]}` },
    ];
    if (filtered[i + 1] !== undefined)
      row.push({
        text: formatSlot(filtered[i + 1] ?? ""),
        callback_data: `et:${filtered[i + 1]}`,
      });
    rows.push(row);
  }
  rows.push([
    { text: "No time", callback_data: "et:none" },
    { text: "Custom…", callback_data: "et:custom" },
  ]);
  rows.push([{ text: "✖ Cancel", callback_data: "cancel" }]);
  const when = isToday ? "today" : "tomorrow";
  return sendOrEditButtons(
    botToken,
    chatId,
    messageId,
    `"${itemTitle.slice(0, 40)}" (${when})\n\nWhat time?`,
    rows
  );
}

export function buildEditCalendarRows(monthStr: string): InlineButton[][] {
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
      { text: "◀", callback_data: `ec:${prevY}-${String(prevM).padStart(2, "0")}` },
      { text: `${MONTH_NAMES[month - 1]} ${year}`, callback_data: "_" },
      { text: "▶", callback_data: `ec:${nextY}-${String(nextM).padStart(2, "0")}` },
    ],
    ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => ({ text: d, callback_data: "_" })),
  ];
  let day = 1;
  let week: InlineButton[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) week.push({ text: " ", callback_data: "_" });
  while (day <= daysInMonth) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    week.push({ text: String(day), callback_data: `ek:${dateStr}` });
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

export async function showEditCalendar(
  botToken: string,
  chatId: string,
  monthStr: string,
  itemTitle: string,
  messageId?: number | null
): Promise<number> {
  return sendOrEditButtons(
    botToken,
    chatId,
    messageId,
    `"${itemTitle.slice(0, 40)}"\n\nPick a new date:`,
    buildEditCalendarRows(monthStr)
  );
}
