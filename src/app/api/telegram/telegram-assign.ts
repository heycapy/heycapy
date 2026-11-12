import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bucketMembers, users } from "@/lib/db/schema";
import { findAccessibleItem } from "@/lib/buckets/access";
import { memberName } from "@/lib/buckets/member-name";
import { allAreMembers, assigneeIdsByItem, setItemAssignees } from "@/lib/items/assignees";
import { bucketsChanged } from "@/lib/events";
import { refreshItemReminders } from "@/lib/reminders/refresh";
import {
  editTelegramHtml,
  sendTelegramButtons,
  sendTelegramWithQuickActions,
  type InlineButton,
} from "@/lib/notifications/telegram";
import { escapeHtml } from "@/lib/notifications/telegram-message";

type Person = { id: number; name: string };

export async function bucketPeople(bucketIds: number[]): Promise<Map<number, Person[]>> {
  const byBucket = new Map<number, Person[]>();
  if (bucketIds.length === 0) return byBucket;
  const rows = await db
    .select({ bucketId: bucketMembers.bucketId, id: users.id, username: users.username })
    .from(bucketMembers)
    .innerJoin(users, eq(users.id, bucketMembers.userId))
    .where(inArray(bucketMembers.bucketId, bucketIds))
    .orderBy(bucketMembers.id);
  for (const row of rows) {
    const person = { id: row.id, name: memberName(row) };
    byBucket.set(row.bucketId, [...(byBucket.get(row.bucketId) ?? []), person]);
  }
  return byBucket;
}

export function sharedBucketIds(people: Map<number, Person[]>): Set<number> {
  return new Set([...people].filter(([, members]) => members.length > 1).map(([id]) => id));
}

// Only shared buckets say who an item is for, a bucket of one has nothing to tell
export function assigneeLabel(
  members: Person[] | undefined,
  assigneeIds: number[],
  viewerId: number
): string | null {
  if (!members || members.length < 2) return null;
  if (assigneeIds.length === 0) return "no one";
  if (members.every((m) => assigneeIds.includes(m.id))) return "everyone";
  return members
    .filter((m) => assigneeIds.includes(m.id))
    .map((m) => (m.id === viewerId ? "you" : m.name))
    .join(", ");
}

export async function assigneeLabels(
  rows: { id: number; bucketId: number }[],
  viewerId: number
): Promise<Map<number, string>> {
  const [people, assigned] = await Promise.all([
    bucketPeople([...new Set(rows.map((r) => r.bucketId))]),
    assigneeIdsByItem(rows.map((r) => r.id)),
  ]);
  const labels = new Map<number, string>();
  for (const row of rows) {
    const label = assigneeLabel(people.get(row.bucketId), assigned.get(row.id) ?? [], viewerId);
    if (label) labels.set(row.id, label);
  }
  return labels;
}

type Ctx = { botToken: string; chatId: string; userId: number };

export async function showAssignPicker(ctx: Ctx, itemId: number, messageId: number): Promise<void> {
  const item = await findAccessibleItem(ctx.userId, itemId);
  if (!item) {
    await editTelegramHtml(ctx.botToken, ctx.chatId, messageId, "this item no longer exists");
    return;
  }
  const members = (await bucketPeople([item.bucketId])).get(item.bucketId) ?? [];
  const chosen = (await assigneeIdsByItem([itemId])).get(itemId) ?? [];
  const rows: InlineButton[][] = members.map((m) => [
    {
      text: `${chosen.includes(m.id) ? "✓ " : ""}${m.id === ctx.userId ? "you" : m.name}`,
      callback_data: `ag:${itemId}:${m.id}`,
    },
  ]);
  rows.push([
    { text: "everyone", callback_data: `ag:${itemId}:all` },
    { text: "no one", callback_data: `ag:${itemId}:none` },
  ]);
  rows.push([{ text: "✔ Done", callback_data: `ag:${itemId}:done` }]);
  await editTelegramHtml(
    ctx.botToken,
    ctx.chatId,
    messageId,
    `<b>${escapeHtml(item.title)}</b>\n<i>who is it for?</i>`,
    rows
  );
}

// ag:<item>:<person id | all | none | open | done>, each tap saves, so there is no half-finished state
export async function handleAssignCallback(
  callbackData: string,
  ctx: Ctx & { messageId: number | undefined }
): Promise<void> {
  const [, rawItem, choice] = callbackData.split(":");
  const itemId = Number(rawItem);
  if (!ctx.messageId || !Number.isInteger(itemId)) return;
  const item = await findAccessibleItem(ctx.userId, itemId);
  if (!item) {
    await showAssignPicker(ctx, itemId, ctx.messageId);
    return;
  }
  if (choice === "open") {
    await showAssignPicker(ctx, itemId, ctx.messageId);
    return;
  }
  if (choice === "done") {
    const labels = await assigneeLabels([item], ctx.userId);
    const label = labels.get(itemId);
    await editTelegramHtml(
      ctx.botToken,
      ctx.chatId,
      ctx.messageId,
      `<b>${escapeHtml(item.title)}</b>${label ? `\n<i>for ${escapeHtml(label)}</i>` : ""}`
    );
    return;
  }

  const members = (await bucketPeople([item.bucketId])).get(item.bucketId) ?? [];
  const current = (await assigneeIdsByItem([itemId])).get(itemId) ?? [];
  let next: number[];
  if (choice === "all") next = members.map((m) => m.id);
  else if (choice === "none") next = [];
  else {
    const person = Number(choice);
    next = current.includes(person) ? current.filter((id) => id !== person) : [...current, person];
  }
  if (!(await allAreMembers(item.bucketId, next))) {
    await showAssignPicker(ctx, itemId, ctx.messageId);
    return;
  }
  await setItemAssignees(itemId, next);
  await refreshItemReminders([itemId]);
  bucketsChanged([item.bucketId]);
  await showAssignPicker(ctx, itemId, ctx.messageId);
}

export async function sendAdded(
  botToken: string,
  chatId: string,
  text: string,
  bucketId: number,
  itemId: number
): Promise<void> {
  const members = (await bucketPeople([bucketId])).get(bucketId) ?? [];
  if (members.length < 2) {
    await sendTelegramWithQuickActions(botToken, chatId, text);
    return;
  }
  await sendTelegramButtons(botToken, chatId, text, [
    [{ text: "👥 Assign", callback_data: `ag:${itemId}:open` }],
  ]);
}
