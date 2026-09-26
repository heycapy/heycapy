import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { requireApiSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets, chatMessages, chatSessions, userSettings, users } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";
import { decryptValue } from "@/lib/crypto";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { CAPY_TOOLS, executeToolCall, getUpcomingItems } from "@/lib/ai/capyTools";
import { compactSessionIfNeeded } from "@/lib/ai/compact";
import { aiErrorResponse } from "@/lib/errors";
import type { AgentMessage } from "@/lib/ai/types";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().max(10_000),
      })
    )
    .max(100),
  sessionId: z.number().nullish(),
});

export async function POST(req: Request) {
  const [session, authErr] = await requireApiSession();
  if (authErr) return authErr;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const { messages, sessionId } = parsed.data;

  const [settings, user, userBuckets] = await Promise.all([
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, session.userId) }),
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    db
      .select({
        id: buckets.id,
        name: buckets.name,
        icon: buckets.icon,
        itemsRules: buckets.itemsRules,
        notificationsRules: buckets.notificationsRules,
      })
      .from(buckets)
      .where(
        and(
          eq(buckets.userId, session.userId),
          isNull(buckets.deletedAt),
          isNull(buckets.archivedAt)
        )
      ),
  ]);

  const timezone = settings?.timezone ?? "UTC";

  const [upcomingItems, provider] = await Promise.all([
    getUpcomingItems(session.userId, timezone),
    Promise.resolve(
      getAIProvider({
        provider: settings?.aiProvider,
        model: settings?.aiModel,
        apiKey: settings?.aiApiKey ? decryptValue(settings.aiApiKey) : null,
        ollamaUrl: settings?.aiOllamaUrl,
      })
    ),
  ]);

  const systemMsg: AgentMessage = {
    role: "system",
    content: buildSystemPrompt(
      settings ?? null,
      userBuckets,
      user?.email ?? "",
      new Date(),
      upcomingItems
    ),
  };

  const threshold = settings?.aiCompactThreshold ?? 40;
  const keepRecent = Math.max(10, Math.floor(threshold / 4));

  let sessionSummary: string | null = null;
  if (sessionId) {
    const sess = await db.query.chatSessions.findFirst({
      where: (s, { eq: qeq, and: qand }) =>
        qand(qeq(s.id, sessionId), qeq(s.userId, session.userId)),
    });
    sessionSummary = sess?.summary ?? null;
  }

  const filtered = messages.filter(
    (m): m is { role: "user" | "assistant"; content: string } => m.role !== "system"
  );
  const contextMessages = filtered.length > threshold ? filtered.slice(-keepRecent) : filtered;

  const agentMessages: AgentMessage[] = [
    systemMsg,
    ...(sessionSummary
      ? [
          {
            role: "system" as const,
            content: `Summary of earlier conversation:\n${sessionSummary}`,
          },
        ]
      : []),
    ...contextMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let finalText = "";
  let lastAssistantContent = "";

  try {
    for (let round = 0; round < 8; round++) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutMs = settings?.aiProvider === "ollama" ? 120_000 : 30_000;
      const result = await Promise.race([
        provider.complete(agentMessages, CAPY_TOOLS),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("AI provider timeout")), timeoutMs);
        }),
      ]).finally(() => clearTimeout(timer));

      if (result.content) lastAssistantContent = result.content;

      if (result.toolCalls.length === 0) {
        finalText = result.content ?? "";
        break;
      }

      agentMessages.push({
        role: "assistant",
        content: result.content,
        toolCalls: result.toolCalls,
      });

      for (const call of result.toolCalls) {
        const toolResult = await executeToolCall(call, session.userId, timezone);
        agentMessages.push({
          role: "tool",
          toolCallId: call.id,
          toolName: call.name,
          content: toolResult,
        });
      }
    }

    if (!finalText) finalText = lastAssistantContent;
  } catch (err) {
    return aiErrorResponse(err, "chat");
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  let resolvedSessionId = sessionId ?? null;

  if (lastUserMsg && finalText) {
    if (resolvedSessionId) {
      const owned = await db.query.chatSessions.findFirst({
        where: (s, { eq: qeq, and: qand }) =>
          qand(qeq(s.id, resolvedSessionId as number), qeq(s.userId, session.userId)),
      });
      if (owned) {
        await db.insert(chatMessages).values([
          {
            sessionId: resolvedSessionId as number,
            userId: session.userId,
            role: "user",
            content: lastUserMsg.content,
          },
          {
            sessionId: resolvedSessionId as number,
            userId: session.userId,
            role: "assistant",
            content: finalText,
          },
        ]);
        await db
          .update(chatSessions)
          .set({ updatedAt: new Date() })
          .where(
            and(
              eq(chatSessions.id, resolvedSessionId as number),
              eq(chatSessions.userId, session.userId)
            )
          );
      }
    } else {
      const title = lastUserMsg.content.replace(/\n/g, " ").slice(0, 60);
      const [newSession] = await db
        .insert(chatSessions)
        .values({ userId: session.userId, title })
        .returning({ id: chatSessions.id });
      resolvedSessionId = newSession.id;
      await db.insert(chatMessages).values([
        {
          sessionId: resolvedSessionId,
          userId: session.userId,
          role: "user",
          content: lastUserMsg.content,
        },
        {
          sessionId: resolvedSessionId,
          userId: session.userId,
          role: "assistant",
          content: finalText,
        },
      ]);
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(finalText || "Something went wrong. Please try again."));
      controller.close();
    },
  });

  if (resolvedSessionId) {
    void compactSessionIfNeeded(resolvedSessionId, provider, settings?.aiCompactThreshold ?? 40);
  }

  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
  if (resolvedSessionId) {
    responseHeaders["X-Session-Id"] = String(resolvedSessionId);
  }

  return new Response(stream, { headers: responseHeaders });
}
