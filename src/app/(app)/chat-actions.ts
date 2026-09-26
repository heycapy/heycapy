"use server";

import { asc, desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";

export async function getChatSessionsAction(): Promise<
  { id: number; title: string; updatedAt: Date }[]
> {
  const session = await getSession();
  if (!session) return [];

  const result = await db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, session.userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(50);

  return result;
}

export async function getChatMessagesAction(
  sessionId: number
): Promise<{ role: "user" | "assistant"; content: string }[] | null> {
  const session = await getSession();
  if (!session) return null;

  const owned = await db.query.chatSessions.findFirst({
    where: (s, { eq: qeq, and: qand }) => qand(qeq(s.id, sessionId), qeq(s.userId, session.userId)),
  });
  if (!owned) return null;

  const msgs = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));

  return msgs;
}

export async function deleteChatSessionAction(sessionId: number): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };

  const owned = await db.query.chatSessions.findFirst({
    where: (s, { eq: qeq, and: qand }) => qand(qeq(s.id, sessionId), qeq(s.userId, session.userId)),
  });
  if (!owned) return { ok: false };

  await db.delete(chatSessions).where(eq(chatSessions.id, sessionId));

  return { ok: true };
}
