"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { deleteSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets, items } from "@/lib/db/schema";

export async function logoutAction() {
  await deleteSession();
  redirect("/login");
}

export async function createBucketAction(
  templateId: number,
  name: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name is required" };
  if (trimmed.length > 100) return { ok: false, error: "Name too long" };

  const template = await db.query.templates.findFirst({
    where: (t, { eq: qeq }) => qeq(t.id, templateId),
  });
  if (!template) return { ok: false, error: "Template not found" };

  const rules = JSON.parse(template.rulesJson) as Record<string, unknown>;

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${buckets.sortOrder}), -1)` })
    .from(buckets)
    .where(eq(buckets.userId, session.userId));

  await db.insert(buckets).values({
    userId: session.userId,
    name: trimmed,
    notificationsRules: JSON.stringify(rules.notifications ?? {}),
    itemsRules: JSON.stringify(rules.items ?? {}),
    mcpRules: rules.mcp ? JSON.stringify(rules.mcp) : null,
    personalityRules: JSON.stringify(rules.personality ?? {}),
    sortOrder: maxRow.max + 1,
  });

  revalidatePath("/");
  return { ok: true };
}

export async function addItemAction(
  bucketId: number,
  title: string,
  deadline: string | null,
  status?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > 500) return { ok: false, error: "Title too long" };

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(${items.sortOrder}), -1)` })
    .from(items)
    .where(eq(items.bucketId, bucketId));

  await db.insert(items).values({
    bucketId,
    userId: session.userId,
    title: trimmed,
    deadline: deadline ? new Date(deadline + "T12:00:00") : null,
    status: status ?? "active",
    sortOrder: maxRow.max + 1,
  });

  revalidatePath("/");
  return { ok: true };
}

export async function updateItemAction(
  itemId: number,
  title: string,
  deadline: string | null,
  status?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Title is required" };
  if (trimmed.length > 500) return { ok: false, error: "Title too long" };

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .update(items)
    .set({
      title: trimmed,
      deadline: deadline ? new Date(deadline + "T12:00:00") : null,
      ...(status !== undefined && { status }),
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function completeItemAction(
  itemId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .update(items)
    .set({
      status: item.status === "completed" ? "active" : "completed",
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}

export async function reorderItemsAction(
  bucketId: number,
  orderedIds: number[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const bucket = await db.query.buckets.findFirst({
    where: (b, { eq: qeq, and: qand }) => qand(qeq(b.id, bucketId), qeq(b.userId, session.userId)),
  });
  if (!bucket) return { ok: false, error: "Bucket not found" };

  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(items)
      .set({ sortOrder: i })
      .where(and(eq(items.id, orderedIds[i]), eq(items.userId, session.userId)));
  }

  revalidatePath("/");
  return { ok: true };
}

export async function deleteItemAction(
  itemId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) redirect("/login");

  const item = await db.query.items.findFirst({
    where: (i, { eq: qeq, and: qand }) => qand(qeq(i.id, itemId), qeq(i.userId, session.userId)),
  });
  if (!item) return { ok: false, error: "Item not found" };

  await db
    .update(items)
    .set({ deletedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.userId, session.userId)));

  revalidatePath("/");
  return { ok: true };
}
