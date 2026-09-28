import { formatWhen } from "@/lib/format-date";
import { ITEM_STATUS } from "@/constants";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { sendTelegramButtons, sendTelegramWithQuickActions } from "@/lib/notifications/telegram";
import type { InlineButton } from "@/lib/notifications/telegram";
import {
  getUserBuckets,
  getBucketTelegramConfig,
  parseNaturalDeadline,
  createItem,
} from "./telegram-utils";
import { dataEvents } from "@/lib/events";

export async function cmdBuckets(
  botToken: string,
  chatId: string,
  userId: number
): Promise<number> {
  const rows = await getUserBuckets(userId);
  if (rows.length === 0) {
    await sendTelegramWithQuickActions(botToken, chatId, "No buckets yet. Create one in the app.");
    return 0;
  }
  const counts = await db
    .select({ bucketId: items.bucketId, count: sql<number>`count(*)` })
    .from(items)
    .where(
      and(
        eq(items.userId, userId),
        isNull(items.deletedAt),
        ne(items.status, ITEM_STATUS.completed)
      )
    )
    .groupBy(items.bucketId);
  const countMap = new Map(counts.map((c) => [c.bucketId, c.count]));
  const buttonRows: InlineButton[][] = rows.map((b) => {
    const n = countMap.get(b.id) ?? 0;
    return [
      {
        text: `${b.icon ? b.icon + " " : ""}${b.name}  ·  ${n} item${n === 1 ? "" : "s"}`,
        callback_data: `lb:${b.id}`,
      },
    ];
  });
  return sendTelegramButtons(botToken, chatId, "Your buckets — tap to browse:", buttonRows);
}

export async function cmdAddDirect(
  args: string,
  userId: number,
  timezone: string
): Promise<string> {
  const atIdx = args.indexOf(" @ ");
  const mainPart = atIdx !== -1 ? args.slice(0, atIdx).trim() : args.trim();
  const deadlinePart = atIdx !== -1 ? args.slice(atIdx + 3).trim() : null;
  const spaceIdx = mainPart.indexOf(" ");
  if (spaceIdx === -1) return "Usage: /add <bucket#> <title> [@ <deadline>]";
  const bucketNum = Number(mainPart.slice(0, spaceIdx));
  const title = mainPart.slice(spaceIdx + 1).trim();
  if (!Number.isInteger(bucketNum) || bucketNum < 1)
    return "Usage: /add <bucket#> <title> [@ <deadline>]";
  if (!title) return "Title cannot be empty.";
  const userBuckets = await getUserBuckets(userId);
  const bucket = userBuckets[bucketNum - 1];
  if (!bucket) return `Bucket #${bucketNum} not found. Use /buckets to see your list.`;
  let deadline: Date | null = null;
  if (deadlinePart) {
    deadline = parseNaturalDeadline(deadlinePart, timezone);
    if (!deadline)
      return `Couldn't parse deadline: "${deadlinePart}". Try "tomorrow", "next friday", "dec 25", or "in 3 days".`;
  }
  await createItem(userId, bucket.id, title, deadline);
  dataEvents.emit("refresh", userId);
  const note = deadline ? ` (due ${formatWhen(deadline, new Date(), timezone)})` : "";
  return `Added "${title}" to ${bucket.name}${note} ✓`;
}

export async function buildHelpText(userId: number): Promise<string> {
  const allBuckets = await getUserBuckets(userId);
  const aliases: string[] = [];
  for (const b of allBuckets) {
    const cfg = await getBucketTelegramConfig(b.id);
    if (cfg.alias) aliases.push(`/${cfg.alias} — add to ${b.name}`);
  }
  return [
    "Commands:",
    "/buckets — browse your buckets",
    "/list — upcoming items (7 days)",
    "/due — items due today",
    "/overdue — overdue items",
    "/add — guided add (buttons)",
    "/add <#> <title> [@ <deadline>] — quick add",
    ...(aliases.length > 0 ? ["", "Your shortcuts:", ...aliases] : []),
    "",
    "Or tap ➕ Add · 📝 List below.",
  ].join("\n");
}
