import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsage, chatMessages, chatSessions, userSettings } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";
import { compactSessionIfNeeded } from "@/lib/ai/compact";
import { recordUsage } from "@/lib/ai/usage";
import { connectOwnChat, say } from "./telegram-helpers";
import { seedUser } from "./helpers";

// a user's ollama is reached through postJson; here it goes to the stubbed fetch like the rest
vi.mock("@/lib/notifications/post-json", () => ({
  postJson: async (url: URL, body: string) => {
    const res = await fetch(url.href, { method: "POST", body });
    return { status: res.status, text: await res.text() };
  },
}));

const OLLAMA_URL = "http://ollama.test";

let ollamaReplies: (Record<string, unknown> | "fail")[] = [];

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      if (String(url).startsWith(OLLAMA_URL)) {
        const reply = ollamaReplies.shift();
        if (!reply || reply === "fail") return new Response("boom", { status: 500 });
        return new Response(JSON.stringify(reply), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
      });
    })
  );
});
afterEach(() => {
  ollamaReplies = [];
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const toolCall = {
  message: {
    role: "assistant",
    content: "",
    tool_calls: [{ function: { name: "list_buckets", arguments: {} } }],
  },
  prompt_eval_count: 1000,
  eval_count: 50,
};
const answer = {
  message: { role: "assistant", content: "you have no buckets yet" },
  prompt_eval_count: 1200,
  eval_count: 30,
};

async function seedCapyUser() {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ aiProvider: "ollama", aiOllamaUrl: OLLAMA_URL, aiModel: "llama3.2" })
    .where(eq(userSettings.userId, userId));
  return { userId, chat: await connectOwnChat(userId) };
}

function usageRows(userId: number) {
  return db.select().from(aiUsage).where(eq(aiUsage.userId, userId)).all();
}

it("a capy answer records the tokens of every model call it took", async () => {
  const { userId, chat } = await seedCapyUser();
  ollamaReplies = [toolCall, answer];

  await say("what buckets do I have?", chat);

  const session = await db.query.chatSessions.findFirst({
    where: eq(chatSessions.userId, userId),
  });
  expect(usageRows(userId)).toEqual([
    expect.objectContaining({
      sessionId: session?.id,
      source: "telegram",
      provider: "ollama",
      model: "llama3.2",
      key: "own",
      calls: 2,
      inputTokens: 2200,
      outputTokens: 80,
      unreportedCalls: 0,
    }),
  ]);
});

it("an answer that fails part way still records the calls made before it", async () => {
  const { userId, chat } = await seedCapyUser();
  ollamaReplies = [toolCall, "fail"];

  await say("what buckets do I have?", chat);

  expect(usageRows(userId)).toEqual([
    expect.objectContaining({ calls: 1, inputTokens: 1000, outputTokens: 50 }),
  ]);
});

it("a call whose provider reports no tokens is counted as unreported", async () => {
  const { userId, chat } = await seedCapyUser();
  ollamaReplies = [{ message: { role: "assistant", content: "hi" } }];

  await say("hello", chat);

  expect(usageRows(userId)).toEqual([
    expect.objectContaining({ calls: 1, inputTokens: 0, outputTokens: 0, unreportedCalls: 1 }),
  ]);
});

it("a chat summary records its tokens", async () => {
  const { userId } = await seedCapyUser();
  const [session] = await db
    .insert(chatSessions)
    .values({ userId, title: "long chat" })
    .returning();
  await db.insert(chatMessages).values(
    Array.from({ length: 50 }, (_, i) => ({
      sessionId: session.id,
      userId,
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `message ${i}`,
    }))
  );
  ollamaReplies = [
    {
      message: { role: "assistant", content: "a summary" },
      prompt_eval_count: 900,
      eval_count: 40,
    },
  ];

  await compactSessionIfNeeded(
    userId,
    session.id,
    getAIProvider({ provider: "ollama", ollamaUrl: OLLAMA_URL, model: "llama3.2" }),
    40
  );

  expect(usageRows(userId)).toEqual([
    expect.objectContaining({
      sessionId: session.id,
      source: "summary",
      calls: 1,
      inputTokens: 900,
      outputTokens: 40,
    }),
  ]);
});

it("marks who pays for the model: the user's own key or ours", () => {
  vi.stubEnv("AI_API_KEY", "server-key");
  vi.stubEnv("OLLAMA_URL", "http://server-ollama.test");

  expect(getAIProvider({ provider: "groq", apiKey: "user-key" }).meta.key).toBe("own");
  expect(getAIProvider({ provider: "groq" }).meta.key).toBe("server");
  expect(getAIProvider({ provider: "ollama", ollamaUrl: OLLAMA_URL }).meta.key).toBe("own");
  expect(getAIProvider({ provider: "ollama" }).meta.key).toBe("server");
  expect(getAIProvider({ provider: "anthropic", apiKey: "user-key" }).meta).toEqual({
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    key: "own",
  });
});

it("keeps the cached part of the prompt tokens, summed over an answer's calls", async () => {
  const userId = await seedUser();
  const call = (read: number, write: number) => ({
    inputTokens: 5000,
    outputTokens: 40,
    cacheReadTokens: read,
    cacheWriteTokens: write,
  });

  recordUsage({
    userId,
    sessionId: null,
    source: "web",
    meta: { provider: "anthropic", model: "claude-haiku-4-5-20251001", key: "server" },
    calls: [call(0, 4000), call(4000, 900), null],
  });

  expect(usageRows(userId)).toEqual([
    expect.objectContaining({
      calls: 3,
      inputTokens: 10_000,
      cacheReadTokens: 4000,
      cacheWriteTokens: 4900,
      unreportedCalls: 1,
    }),
  ]);
});
