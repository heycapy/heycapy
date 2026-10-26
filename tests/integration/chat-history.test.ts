import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { chatMessages, chatSessions, items, userSettings } from "@/lib/db/schema";
import { POST as chatPOST } from "@/app/api/chat/route";
import { getAIProvider } from "@/lib/ai";
import { compactSessionIfNeeded } from "@/lib/ai/compact";
import { connectOwnChat, say } from "./telegram-helpers";
import { seedBucket, seedUser } from "./helpers";

// a user's ollama is reached through postJson, here it goes to the stubbed fetch like the rest
vi.mock("@/lib/notifications/post-json", () => ({
  postJson: async (url: URL, body: string) => {
    const res = await fetch(url.href, { method: "POST", body });
    return { status: res.status, text: await res.text() };
  },
}));

const OLLAMA_URL = "http://ollama.test";
const auth = vi.hoisted(() => ({ userId: 0 }));
vi.mock("@/lib/auth/session", () => ({
  requireApiSession: async () => [{ userId: auth.userId }, null],
}));

type SentMessage = { role: string; content: string };
let modelRequests: SentMessage[][] = [];
// replies the model gives before its usual "ok", like a round of tool calls
let modelScript: unknown[] = [];
let summaryRequests: SentMessage[][] = [];

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith(OLLAMA_URL)) {
        const body = JSON.parse(String(init?.body)) as { messages: SentMessage[]; tools?: unknown };
        if (!body.tools) {
          summaryRequests.push(body.messages);
          return new Response(
            JSON.stringify({ message: { role: "assistant", content: "SUMMARY" } }),
            { status: 200 }
          );
        }
        modelRequests.push(body.messages);
        const message = modelScript.shift() ?? { role: "assistant", content: "ok" };
        return new Response(JSON.stringify({ message }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
      });
    })
  );
});
afterEach(() => {
  modelRequests = [];
  modelScript = [];
  summaryRequests = [];
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function seedCapyUser() {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ aiProvider: "ollama", aiOllamaUrl: OLLAMA_URL, aiModel: "llama3.2" })
    .where(eq(userSettings.userId, userId));
  return userId;
}

const said = (i: number) => `message ${i}`;

async function addMessages(userId: number, sessionId: number, from: number, to: number) {
  await db.insert(chatMessages).values(
    Array.from({ length: to - from }, (_, n) => ({
      sessionId,
      userId,
      role: (from + n) % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: said(from + n),
    }))
  );
}

async function seedChat(userId: number, count: number, source: "web" | "telegram" = "web") {
  const [session] = await db
    .insert(chatSessions)
    .values({ userId, title: "chat", source })
    .returning();
  await addMessages(userId, session.id, 0, count);
  return session.id;
}

const ollama = () =>
  getAIProvider({ provider: "ollama", ollamaUrl: OLLAMA_URL, model: "llama3.2" });

async function askOnWeb(userId: number, sessionId: number, history: number, text: string) {
  auth.userId = userId;
  const res = await chatPOST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        messages: [
          ...Array.from({ length: history }, (_, i) => ({
            role: i % 2 === 0 ? "user" : "assistant",
            content: said(i),
          })),
          { role: "user", content: text },
        ],
      }),
    })
  );
  await res.text();
}

// What the model was given for the latest question, besides the system prompt
function lastContext(): string[] {
  const sent = modelRequests.at(-1) ?? [];
  return sent.slice(1).map((m) => m.content);
}

it("web: in a chat past the limit but not yet summarised, capy still sees its start", async () => {
  const userId = await seedCapyUser();
  const sessionId = await seedChat(userId, 44);

  await askOnWeb(userId, sessionId, 44, "what did I say first?");

  expect(lastContext()).toContain(said(0));
});

it("telegram: a 30-message chat is given to capy in full", async () => {
  const userId = await seedCapyUser();
  const chat = await connectOwnChat(userId);
  await seedChat(userId, 30, "telegram");

  await say("what did I say first?", chat);

  expect(lastContext()).toContain(said(0));
  expect(lastContext()).toContain(said(29));
});

it("after a summary, capy gets it plus every message since", async () => {
  const userId = await seedCapyUser();
  const sessionId = await seedChat(userId, 60);
  await compactSessionIfNeeded(userId, sessionId, ollama(), 40);
  await addMessages(userId, sessionId, 60, 68);

  await askOnWeb(userId, sessionId, 68, "and now?");

  const context = lastContext();
  expect(context[0]).toBe("Summary of earlier conversation:\nSUMMARY");
  expect(context.slice(1)).toEqual([
    ...Array.from({ length: 18 }, (_, n) => said(50 + n)),
    "and now?",
  ]);
});

it("the next summary folds only the newer messages into the previous one", async () => {
  const userId = await seedCapyUser();
  const sessionId = await seedChat(userId, 60);
  await compactSessionIfNeeded(userId, sessionId, ollama(), 40);
  await addMessages(userId, sessionId, 60, 100);

  await compactSessionIfNeeded(userId, sessionId, ollama(), 40);

  const input = summaryRequests.at(-1)?.[1]?.content ?? "";
  expect(input.startsWith("Summary so far:\nSUMMARY\n\nNew messages:\n")).toBe(true);
  expect(input).toContain(said(50));
  expect(input).toContain(said(89));
  expect(input).not.toContain(said(49));
  expect(input).not.toContain(said(90));
});

it("a chat is summarised on its own once it passes the limit", async () => {
  const userId = await seedCapyUser();
  const sessionId = await seedChat(userId, 44);

  await askOnWeb(userId, sessionId, 44, "one more");

  await vi.waitFor(async () => {
    const session = await db.query.chatSessions.findFirst({
      where: eq(chatSessions.id, sessionId),
    });
    expect(session?.summary).toBe("SUMMARY");
  });
  expect(summaryRequests).toHaveLength(1);
});

function toolRound(...calls: [string, Record<string, unknown>][]) {
  return {
    role: "assistant",
    content: "",
    tool_calls: calls.map(([name, args]) => ({ function: { name, arguments: args } })),
  };
}

async function addedItemId(bucketId: number) {
  const [row] = await db.select({ id: items.id }).from(items).where(eq(items.bucketId, bucketId));
  return row.id;
}

it.each(["web", "telegram"] as const)(
  "%s: capy's next message knows what its tools changed, not just what it said",
  async (source) => {
    const userId = await seedCapyUser();
    const bucketId = await seedBucket(userId);
    const chat = await connectOwnChat(userId);
    const sessionId = await seedChat(userId, 2, source);
    const ask = (text: string) =>
      source === "web" ? askOnWeb(userId, sessionId, 0, text) : say(text, chat);
    modelScript = [
      toolRound(
        ["search_items", { keyword: "netflix" }],
        ["add_item", { bucket_id: bucketId, title: "Netflix" }],
        ["delete_item", { item_id: 999999 }]
      ),
    ];

    await ask("add netflix");
    await ask("and now?");

    const itemId = await addedItemId(bucketId);
    expect(lastContext().slice(-2)).toEqual([
      "ok",
      "<tools_used>\n" +
        `- add_item {"bucket_id":${bucketId},"title":"Netflix"} → done, new item ${itemId}\n` +
        '- delete_item {"item_id":999999} → failed: Item not found\n' +
        "</tools_used>\nand now?",
    ]);
  }
);

it("a reply without tools is given back as it was said", async () => {
  const userId = await seedCapyUser();
  const sessionId = await seedChat(userId, 2);

  await askOnWeb(userId, sessionId, 0, "hi");
  await askOnWeb(userId, sessionId, 0, "and now?");

  expect(lastContext()).toEqual([said(0), said(1), "hi", "ok", "and now?"]);
});

it("a summary keeps what capy's tools changed", async () => {
  const userId = await seedCapyUser();
  const sessionId = await seedChat(userId, 60);
  await db
    .update(chatMessages)
    .set({ toolLog: '- add_item {"title":"Netflix"} → done, new item 54' })
    .where(eq(chatMessages.content, said(1)));

  await compactSessionIfNeeded(userId, sessionId, ollama(), 40);

  expect(summaryRequests.at(-1)?.[1]?.content).toContain(
    `assistant: ${said(1)}\n(its tools: - add_item {"title":"Netflix"} → done, new item 54)`
  );
});
