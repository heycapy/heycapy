import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { logAIError } from "@/lib/errors";
import type { MeteredProvider } from "./index";
import type { AgentMessage } from "./types";
import { recordUsage } from "./usage";

const SUMMARY_PROMPT =
  "Summarize the conversation concisely. Preserve: key facts, items created/updated/deleted, decisions made, and any context needed to continue the conversation. If a summary so far is given, fold the new messages into it. Output only the summary — no preamble.";

async function unsummarized(sessionId: number) {
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
  });
  const messages = await db
    .select({ id: chatMessages.id, role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(
      and(eq(chatMessages.sessionId, sessionId), gt(chatMessages.id, session?.summaryThrough ?? 0))
    )
    // A question and its reply share a created_at second; ids keep their order
    .orderBy(asc(chatMessages.id));
  return { summary: session?.summary ?? null, messages };
}

// The summary stands in for everything it covers; every message after it goes to the model as is
export async function chatHistory(sessionId: number): Promise<AgentMessage[]> {
  const { summary, messages } = await unsummarized(sessionId);
  return [
    ...(summary
      ? [{ role: "system" as const, content: `Summary of earlier conversation:\n${summary}` }]
      : []),
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

const running = new Set<number>();

// Once more than `threshold` messages follow the summary, folds all but the latest few into it
export async function compactSessionIfNeeded(
  userId: number,
  sessionId: number,
  provider: MeteredProvider,
  threshold = 40
): Promise<void> {
  if (running.has(sessionId)) return;
  running.add(sessionId);
  try {
    const { summary, messages } = await unsummarized(sessionId);
    if (messages.length <= threshold) return;

    const keepRecent = Math.max(10, Math.floor(threshold / 4));
    const toSummarize = messages.slice(0, -keepRecent);
    const last = toSummarize.at(-1);
    if (!last) return;

    const transcript = toSummarize.map((m) => `${m.role}: ${m.content}`).join("\n\n");
    const result = await provider.chat([
      { role: "system", content: SUMMARY_PROMPT },
      {
        role: "user",
        content: summary
          ? `Summary so far:\n${summary}\n\nNew messages:\n${transcript}`
          : transcript,
      },
    ]);
    recordUsage({
      userId,
      sessionId,
      source: "summary",
      meta: provider.meta,
      calls: [result.usage],
    });
    if (!result.text) return;

    // Messages are never deleted, only covered by the summary
    await db
      .update(chatSessions)
      .set({ summary: result.text, summaryThrough: last.id })
      .where(eq(chatSessions.id, sessionId));
  } catch (err) {
    logAIError(err, "summary");
  } finally {
    running.delete(sessionId);
  }
}
