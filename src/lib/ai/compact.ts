import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatSessions } from "@/lib/db/schema";
import { logAIError } from "@/lib/errors";
import type { MeteredProvider } from "./index";
import type { AgentMessage } from "./types";
import { withToolLog } from "./toolLog";
import { recordUsage } from "./usage";

const SUMMARY_PROMPT =
  "Summarize the conversation concisely. Preserve: key facts, items created/updated/deleted, decisions made, and any context needed to continue the conversation. If a summary so far is given, fold the new messages into it. Output only the summary — no preamble.";

async function unsummarized(sessionId: number) {
  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.id, sessionId),
  });
  const messages = await db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      toolLog: chatMessages.toolLog,
    })
    .from(chatMessages)
    .where(
      and(eq(chatMessages.sessionId, sessionId), gt(chatMessages.id, session?.summaryThrough ?? 0))
    )
    // A question and its reply share a created_at second, ids keep their order
    .orderBy(asc(chatMessages.id));
  return { summary: session?.summary ?? null, messages };
}

// The summary stands in for everything it covers, every message after it goes to the model as is.
// What capy's tools did rides on the next user message: in capy's own replies the model copies it
export async function chatHistory(sessionId: number, userText: string): Promise<AgentMessage[]> {
  const { summary, messages } = await unsummarized(sessionId);
  let toolLog: string | null = null;
  const turns: AgentMessage[] = [];
  for (const m of [...messages, { role: "user" as const, content: userText, toolLog: null }]) {
    if (m.role === "assistant") {
      turns.push({ role: "assistant", content: m.content });
      toolLog = m.toolLog;
    } else {
      turns.push({ role: "user", content: withToolLog(m.content, toolLog) });
      toolLog = null;
    }
  }
  return [
    ...(summary
      ? [{ role: "system" as const, content: `Summary of earlier conversation:\n${summary}` }]
      : []),
    ...turns,
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

    const transcript = toSummarize
      .map((m) => `${m.role}: ${m.content}${m.toolLog ? `\n(its tools: ${m.toolLog})` : ""}`)
      .join("\n\n");
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
