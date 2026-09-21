import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { buckets, userSettings, users } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ai/systemPrompt";
import { CAPY_TOOLS, executeToolCall } from "@/lib/ai/capyTools";
import type { AgentMessage } from "@/lib/ai/types";

const bodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant", "system"]),
      content: z.string(),
    })
  ),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const { messages } = parsed.data;

  const [settings, user, userBuckets] = await Promise.all([
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, session.userId) }),
    db.query.users.findFirst({ where: eq(users.id, session.userId) }),
    db
      .select({ id: buckets.id, name: buckets.name, icon: buckets.icon })
      .from(buckets)
      .where(
        and(
          eq(buckets.userId, session.userId),
          isNull(buckets.deletedAt),
          isNull(buckets.archivedAt)
        )
      ),
  ]);

  const provider = getAIProvider({
    provider: settings?.aiProvider,
    model: settings?.aiModel,
    apiKey: settings?.aiApiKey,
    ollamaUrl: settings?.aiOllamaUrl,
  });

  const systemMsg: AgentMessage = {
    role: "system",
    content: buildSystemPrompt(settings ?? null, userBuckets, user?.email ?? "", new Date()),
  };

  const agentMessages: AgentMessage[] = [
    systemMsg,
    ...messages
      .filter((m): m is { role: "user" | "assistant"; content: string } => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content })),
  ];

  let finalText = "";

  for (let round = 0; round < 5; round++) {
    const result = await provider.complete(agentMessages, CAPY_TOOLS);

    if (result.toolCalls.length === 0) {
      finalText = result.content ?? "";
      break;
    }

    agentMessages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });

    for (const call of result.toolCalls) {
      const toolResult = await executeToolCall(call, session.userId, settings?.timezone ?? "UTC");
      agentMessages.push({
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
        content: toolResult,
      });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(finalText || "Something went wrong. Please try again."));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
