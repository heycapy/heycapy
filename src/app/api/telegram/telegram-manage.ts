import {
  editTelegramHtml,
  sendOrEditButtons,
  sendTelegramWithQuickActions,
} from "@/lib/notifications/telegram";
import { escapeHtml, formatWhen } from "@/lib/notifications/telegram-message";
import type { InlineButton } from "@/lib/notifications/telegram";

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

export type MenuItem = { title: string; deadline: Date | null; bucketName: string };

export async function showItemActionMenu(
  botToken: string,
  chatId: string,
  item: MenuItem,
  timezone: string,
  messageId: number
): Promise<number> {
  const when = item.deadline ? `due ${formatWhen(item.deadline, new Date(), timezone)}` : "no date";
  await editTelegramHtml(
    botToken,
    chatId,
    messageId,
    `<b>${escapeHtml(item.title)}</b>\n<i>${when} · ${escapeHtml(item.bucketName)}</i>`,
    [
      [
        { text: "✓ Complete", callback_data: "la:complete" },
        { text: "✏️ Rename", callback_data: "me:rename" },
      ],
      [
        { text: "🕐 Reschedule", callback_data: "me:deadline" },
        { text: "🗑 Delete", callback_data: "la:delete" },
      ],
      [{ text: "✖ Cancel", callback_data: "cancel" }],
    ]
  );
  return messageId;
}

export async function showDeleteConfirm(
  botToken: string,
  chatId: string,
  itemTitle: string,
  messageId?: number | null
): Promise<number> {
  return sendOrEditButtons(botToken, chatId, messageId, `Delete "${itemTitle}"?`, [
    [
      { text: "🗑 Yes, delete", callback_data: "dc:yes" },
      { text: "✖ No", callback_data: "cancel" },
    ],
  ]);
}

export function buildCalendarRows(monthStr: string, footer: InlineButton[][]): InlineButton[][] {
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
  return [...rows, ...footer];
}
