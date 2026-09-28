import { formatWhen } from "@/lib/format-date";
import { CLOSED_ITEM_STATUSES } from "@/constants";
import { and, asc, eq, gte, isNull, lt, lte, type SQL, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { TELEGRAM_LIST_PAGE_SIZE } from "@/lib/notifications/constants";
import {
  editTelegramHtml,
  sendTelegramHtml,
  sendTelegramWithQuickActions,
  type InlineButton,
} from "@/lib/notifications/telegram";
import { escapeHtml } from "@/lib/notifications/telegram-message";
import { addLocalDays, atLocalClock, overdueFrom } from "@/lib/reminders/zoned";

type Ctx = { botToken: string; chatId: string; userId: number; timezone: string };

// "up" next 7 days, "td" due today, "od" overdue, "b<id>" one bucket
export type ItemListKind = "up" | "td" | "od" | `b${number}`;

type ListRow = { id: number; title: string; deadline: Date | null; bucketName: string };

async function loadList(
  ctx: Ctx,
  kind: ItemListKind,
  now: Date
): Promise<{ heading: string; empty: string; rows: ListRow[]; perBucket: boolean }> {
  const select = (where: SQL | undefined, order: "deadline" | "manual") =>
    db
      .select({
        id: items.id,
        title: items.title,
        deadline: items.deadline,
        bucketName: buckets.name,
      })
      .from(items)
      .innerJoin(buckets, eq(items.bucketId, buckets.id))
      .where(
        and(
          eq(items.userId, ctx.userId),
          isNull(items.deletedAt),
          notInArray(items.status, CLOSED_ITEM_STATUSES as string[]),
          where
        )
      )
      .orderBy(
        ...(order === "deadline"
          ? [asc(items.deadline)]
          : [asc(items.sortOrder), asc(items.createdAt)])
      );

  if (kind === "up") {
    const rows = (
      await select(
        and(
          gte(items.deadline, atLocalClock(now, 0, ctx.timezone)),
          lte(items.deadline, addLocalDays(now, 7, ctx.timezone))
        ),
        "deadline"
      )
    ).filter((r) => r.deadline && overdueFrom(r.deadline, ctx.timezone) > now);
    return {
      heading: "Upcoming · next 7 days",
      empty: "Nothing due in the next 7 days.",
      rows,
      perBucket: false,
    };
  }
  if (kind === "td") {
    const start = atLocalClock(now, 0, ctx.timezone);
    const rows = await select(
      and(gte(items.deadline, start), lt(items.deadline, addLocalDays(start, 1, ctx.timezone))),
      "deadline"
    );
    return { heading: "Due today", empty: "Nothing due today.", rows, perBucket: false };
  }
  if (kind === "od") {
    // Today's all-day items aren't overdue until the day ends
    const rows = (await select(lt(items.deadline, now), "deadline")).filter(
      (r) => r.deadline && overdueFrom(r.deadline, ctx.timezone) <= now
    );
    return { heading: "Overdue", empty: "Nothing overdue.", rows, perBucket: false };
  }
  const bucketId = Number(kind.slice(1));
  const rows = await select(eq(items.bucketId, bucketId), "manual");
  const bucket = await db.query.buckets.findFirst({
    where: and(eq(buckets.id, bucketId), eq(buckets.userId, ctx.userId)),
  });
  const name = bucket?.name ?? "Bucket";
  return { heading: name, empty: `No open items in ${name}.`, rows, perBucket: true };
}

function entry(row: ListRow, n: number, perBucket: boolean, now: Date, timezone: string): string {
  const when = row.deadline ? formatWhen(row.deadline, now, timezone) : "no date";
  const detail = perBucket ? when : `${when} · ${escapeHtml(row.bucketName)}`;
  return `${n}. ${escapeHtml(row.title)}\n     <i>${detail}</i>`;
}

// Titles live in the text so they wrap; the buttons only carry numbers
export async function showItemListPage(
  ctx: Ctx,
  kind: ItemListKind,
  page: number,
  messageId?: number
): Promise<number | null> {
  const now = new Date();
  const list = await loadList(ctx, kind, now);
  if (list.rows.length === 0) {
    if (messageId) {
      await editTelegramHtml(ctx.botToken, ctx.chatId, messageId, escapeHtml(list.empty));
      return messageId;
    }
    await sendTelegramWithQuickActions(ctx.botToken, ctx.chatId, list.empty);
    return null;
  }

  const pages = Math.ceil(list.rows.length / TELEGRAM_LIST_PAGE_SIZE);
  const current = Math.max(0, Math.min(page, pages - 1));
  const first = current * TELEGRAM_LIST_PAGE_SIZE;
  const shown = list.rows.slice(first, first + TELEGRAM_LIST_PAGE_SIZE);

  const heading = `<b>${escapeHtml(list.heading)}</b>${pages > 1 ? ` · page ${current + 1}/${pages}` : ""}`;
  const html = [
    heading,
    ...shown.map((r, i) => entry(r, first + i + 1, list.perBucket, now, ctx.timezone)),
    "<i>tap a number to open it</i>",
  ].join("\n\n");

  const rows: InlineButton[][] = [
    shown.map((r, i) => ({ text: String(first + i + 1), callback_data: `mi:${r.id}` })),
  ];
  if (pages > 1) {
    rows.push([
      ...(current > 0 ? [{ text: "◀", callback_data: `lp:${kind}:${current - 1}` }] : []),
      ...(current < pages - 1 ? [{ text: "▶", callback_data: `lp:${kind}:${current + 1}` }] : []),
    ]);
  }
  rows.push([{ text: "✖ Close", callback_data: "lc" }]);

  if (messageId) {
    await editTelegramHtml(ctx.botToken, ctx.chatId, messageId, html, rows);
    return messageId;
  }
  return sendTelegramHtml(ctx.botToken, ctx.chatId, html, rows);
}

export function parseListKind(raw: string): ItemListKind | null {
  return raw === "up" || raw === "td" || raw === "od" || /^b\d+$/.test(raw)
    ? (raw as ItemListKind)
    : null;
}
