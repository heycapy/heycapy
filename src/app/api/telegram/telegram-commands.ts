import { and, eq, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";
import { getUpcomingItems } from "@/lib/ai/capyTools";
import {
  getUserBuckets,
  createItem,
  getBucketTelegramConfig,
  parseNaturalDeadline,
  fmtDate,
} from "./telegram-utils";
import { dataEvents } from "@/lib/events";

export async function cmdBuckets(userId: number): Promise<string> {
  const rows = await getUserBuckets(userId);
  if (rows.length === 0) return "No buckets yet.";
  const counts = await db
    .select({ bucketId: items.bucketId, count: sql<number>`count(*)` })
    .from(items)
    .where(and(eq(items.userId, userId), isNull(items.deletedAt), ne(items.status, "completed")))
    .groupBy(items.bucketId);
  const countMap = new Map(counts.map((c) => [c.bucketId, c.count]));
  const lines = rows.map((b, i) => {
    const n = countMap.get(b.id) ?? 0;
    return `${i + 1}. ${b.icon ? b.icon + " " : ""}${b.name} (${n} item${n === 1 ? "" : "s"})`;
  });
  return `Buckets:\n${lines.join("\n")}`;
}

export async function cmdList(userId: number, timezone: string): Promise<string> {
  const upcoming = await getUpcomingItems(userId, timezone);
  if (upcoming.length === 0) return "Nothing due in the next 7 days.";
  return `Upcoming (7 days):\n${upcoming.map((it) => `• ${it.title} — ${it.deadlineRelative} [${it.bucket}]`).join("\n")}`;
}

export async function cmdDue(userId: number, timezone: string): Promise<string> {
  const today = (await getUpcomingItems(userId, timezone)).filter(
    (it) => it.deadlineRelative === "today"
  );
  if (today.length === 0) return "Nothing due today.";
  return `Due today:\n${today.map((it) => `• ${it.title} [${it.bucket}]`).join("\n")}`;
}

export async function cmdOverdue(userId: number, timezone: string): Promise<string> {
  const now = new Date();
  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      deadline: items.deadline,
      bucketId: items.bucketId,
    })
    .from(items)
    .where(
      and(
        eq(items.userId, userId),
        isNull(items.deletedAt),
        ne(items.status, "completed"),
        isNotNull(items.deadline),
        lt(items.deadline, now)
      )
    )
    .orderBy(items.deadline)
    .limit(20);
  if (rows.length === 0) return "Nothing overdue.";
  const bucketMap = new Map(
    (
      await db
        .select({ id: buckets.id, name: buckets.name })
        .from(buckets)
        .where(eq(buckets.userId, userId))
    ).map((b) => [b.id, b.name])
  );
  return `Overdue:\n${rows.map((r) => `• ${r.title} (was ${r.deadline ? fmtDate(r.deadline, timezone) : "?"}) [${bucketMap.get(r.bucketId) ?? "?"}]`).join("\n")}`;
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
  const note = deadline ? ` (due ${fmtDate(deadline, timezone)})` : "";
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
    "/buckets — list your buckets",
    "/list — upcoming items (7 days)",
    "/due — items due today",
    "/overdue — overdue items",
    "/add — guided add (buttons)",
    "/add <#> <title> [@ <deadline>] — quick add",
    ...(aliases.length > 0 ? ["", "Your shortcuts:", ...aliases] : []),
    "",
    "Or tap ➕ Add below.",
  ].join("\n");
}
