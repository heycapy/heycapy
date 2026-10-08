import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { requireApiSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets, chatMessages, chatSessions, userSettings, users } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";
import { decryptValue } from "@/lib/crypto";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { getUpcomingItems } from "@/lib/ai/capyTools";
import { chatHistory, compactSessionIfNeeded } from "@/lib/ai/compact";
import { runAgent, type AgentStep } from "@/lib/ai/runAgent";
import { toolStatus } from "@/lib/ai/toolStatus";
import { logAIError, parseProviderError } from "@/lib/errors";
import { AI_REQUEST_TIMEOUT_MS, CHAT_STREAM_PADDING, OLLAMA_REQUEST_TIMEOUT_MS } from "@/constants";
import { recordUsage } from "@/lib/ai/usage";
import { recordKeyResult } from "@/lib/ai/status";
import { chargesCredits, holdMessageCredit, refundMessageCredit } from "@/lib/credits";
import { outOfCreditsMessage } from "@/lib/billing/dodo";
import type { AgentMessage, TokenUsage } from "@/lib/ai/types";
import type { ChatEvent } from "@/lib/ai/chatEvents";

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

type ChatRequest = z.infer<typeof bodySchema>;

async function saveExchange(
  userId: number,
  sessionId: number | null,
  userText: string,
  reply: string
): Promise<number | null> {
  if (sessionId) {
    const owned = await db.query.chatSessions.findFirst({
      where: (s, { eq: qeq, and: qand }) => qand(qeq(s.id, sessionId), qeq(s.userId, userId)),
    });
    if (!owned) return sessionId;
    await db.insert(chatMessages).values([
      { sessionId, userId, role: "user", content: userText },
      { sessionId, userId, role: "assistant", content: reply },
    ]);
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
    return sessionId;
  }

  const title = userText.replace(/\n/g, " ").slice(0, 60);
  const [created] = await db
    .insert(chatSessions)
    .values({ userId, title })
    .returning({ id: chatSessions.id });
  await db.insert(chatMessages).values([
    { sessionId: created.id, userId, role: "user", content: userText },
    { sessionId: created.id, userId, role: "assistant", content: reply },
  ]);
  return created.id;
}

async function answer(userId: number, request: ChatRequest, send: (event: ChatEvent) => void) {
  const { messages, sessionId } = request;

  const [settings, user, userBuckets] = await Promise.all([
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) }),
    db.query.users.findFirst({ where: eq(users.id, userId) }),
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
        and(eq(buckets.userId, userId), isNull(buckets.deletedAt), isNull(buckets.archivedAt))
      ),
  ]);

  const timezone = settings?.timezone ?? "UTC";
  const provider = getAIProvider({
    provider: settings?.aiProvider,
    model: settings?.aiModel,
    apiKey: settings?.aiApiKey ? decryptValue(settings.aiApiKey) : null,
    ollamaUrl: settings?.aiOllamaUrl,
    useOwnKey: settings?.aiUseOwnKey,
  });
  const upcomingItems = await getUpcomingItems(userId, timezone);

  const threshold = settings?.aiCompactThreshold ?? 40;

  const ownedSession = sessionId
    ? await db.query.chatSessions.findFirst({
        where: (s, { eq: qeq, and: qand }) => qand(qeq(s.id, sessionId), qeq(s.userId, userId)),
      })
    : undefined;
  // Earlier messages come from the saved chat, not the browser, so they line up with its summary
  const history = ownedSession ? await chatHistory(ownedSession.id) : [];
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");

  const agentMessages: AgentMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(
        settings ?? null,
        userBuckets,
        user?.email ?? "",
        new Date(),
        upcomingItems
      ),
    },
    ...history,
    ...(lastUserMsg ? [{ role: "user" as const, content: lastUserMsg.content }] : []),
  ];

  const bucketNames = new Map(userBuckets.map((b) => [b.id, b.name]));
  const bucketName = (id: unknown) => bucketNames.get(Number(id)) ?? null;
  const onStep = (step: AgentStep) =>
    send({
      type: "status",
      text: step.kind === "thinking" ? "thinking" : toolStatus(step.call, bucketName),
    });

  const hold = chargesCredits(provider.meta) ? holdMessageCredit(userId) : undefined;
  if (hold === null) {
    send({ type: "error", error: outOfCreditsMessage() });
    return;
  }
  const usage: TokenUsage[] = [];
  let usageSessionId = ownedSession?.id ?? null;
  let reply: string;
  let savedSessionId: number | null;
  let answered = false;
  try {
    reply = await runAgent({
      provider,
      messages: agentMessages,
      userId,
      timezone,
      timeoutMs:
        provider.meta.provider === "ollama" ? OLLAMA_REQUEST_TIMEOUT_MS : AI_REQUEST_TIMEOUT_MS,
      onStep,
      onUsage: (u) => usage.push(u),
    }).catch(async (err: unknown) => {
      await recordKeyResult(userId, provider.meta, err);
      throw err;
    });
    await recordKeyResult(userId, provider.meta);

    savedSessionId =
      lastUserMsg && reply
        ? await saveExchange(userId, sessionId ?? null, lastUserMsg.content, reply)
        : (sessionId ?? null);
    if (!sessionId) usageSessionId = savedSessionId;
    answered = !!reply;
  } finally {
    // Also when the answer failed part way: the calls made before it still cost tokens
    recordUsage({
      userId,
      sessionId: usageSessionId,
      source: "web",
      meta: provider.meta,
      calls: usage,
    });
    if (hold && !answered) refundMessageCredit(hold);
  }

  send({ type: "reply", text: reply || "Something went wrong. Please try again." });
  send({ type: "done", sessionId: savedSessionId });

  if (savedSessionId) void compactSessionIfNeeded(userId, savedSessionId, provider, threshold);
}

export async function POST(req: Request) {
  const [session, authErr] = await requireApiSession();
  if (authErr) return authErr;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ChatEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      controller.enqueue(encoder.encode(CHAT_STREAM_PADDING));
      try {
        await answer(session.userId, parsed.data, send);
      } catch (err) {
        logAIError(err, "chat");
        send({ type: "error", error: parseProviderError(err) });
      }
      if (!closed) controller.close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
