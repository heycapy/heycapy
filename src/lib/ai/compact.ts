import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import type { AIProvider } from "./types";

export async function compactSessionIfNeeded(
  sessionId: number,
  provider: AIProvider,
  threshold = 40
): Promise<void> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId));

  const total = countRow?.count ?? 0;
  if (total <= threshold) return;

  const keepRecent = Math.max(10, Math.floor(threshold / 4));

  // only recompact every keepRecent messages after the threshold
  // so we don't regenerate the summary on every single message
  if ((total - threshold) % keepRecent !== 0) return;

  const all = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));

  const toSummarize = all.slice(0, all.length - keepRecent);
  if (toSummarize.length === 0) return;

  const transcript = toSummarize.map((m) => `${m.role}: ${m.content}`).join("\n\n");

  let summary = "";
  try {
    for await (const chunk of provider.chat([
      {
        role: "system",
        content:
          "Summarize the following conversation concisely. Preserve: key facts, items created/updated/deleted, decisions made, and any context needed to continue the conversation. Output only the summary — no preamble.",
      },
      { role: "user", content: transcript },
    ])) {
      summary += chunk;
    }
  } catch {
    return;
  }

  if (!summary) return;

  // store summary only , never delete messages
  db.transaction((tx) => {
    tx.update(chatSessions).set({ summary }).where(eq(chatSessions.id, sessionId)).run();
  });
}
