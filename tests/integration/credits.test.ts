import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditLedger, userSettings, users } from "@/lib/db/schema";
import { getAIProvider } from "@/lib/ai";
import { getAIStatus } from "@/lib/ai/status";
import {
  adjustCredits,
  creditBalance,
  holdMessageCredit,
  refundMessageCredit,
} from "@/lib/credits";
import { deleteAccount } from "@/lib/account/delete";
import { encryptValue } from "@/lib/crypto";
import { buildAccountExport } from "@/lib/account/export";
import { POST as chatPOST } from "@/app/api/chat/route";
import { adjustUserCreditsAction, getUserCreditsAction } from "@/app/(app)/system-actions";
import { CREDITS_FREE_GRANT, OUT_OF_CREDITS_ERROR } from "@/constants";
import { connectOwnChat, say } from "./telegram-helpers";
import { seedUser } from "./helpers";

let session: { userId: number; email: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => session,
  requireApiSession: async () => [session, null],
}));

const SERVER_OLLAMA = "http://server-ollama.test";
const OWN_OLLAMA = "http://own-ollama.test";

let aiReplies: (Record<string, unknown> | "fail")[] = [];
let aiCalls: string[] = [];
let telegramTexts: string[] = [];

const answer = { message: { role: "assistant", content: "done" } };

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  vi.stubEnv("HOSTED", "true");
  vi.stubEnv("AI_PROVIDER", "ollama");
  vi.stubEnv("AI_MODEL", "server-model");
  vi.stubEnv("OLLAMA_URL", SERVER_OLLAMA);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const target = String(url);
      if (target.startsWith(SERVER_OLLAMA) || target.startsWith(OWN_OLLAMA)) {
        aiCalls.push(target);
        const reply = aiReplies.shift();
        if (!reply || reply === "fail") {
          return new Response(JSON.stringify({ error: "model not found" }), { status: 404 });
        }
        return new Response(JSON.stringify(reply), { status: 200 });
      }
      if (target.endsWith("/sendMessage")) {
        telegramTexts.push(String(JSON.parse(String(init?.body)).text));
      }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
        status: 200,
      });
    })
  );
});
afterEach(() => {
  aiReplies = [];
  aiCalls = [];
  telegramTexts = [];
  session = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function ledger(userId: number) {
  return db
    .select({ amount: creditLedger.amount, kind: creditLedger.kind })
    .from(creditLedger)
    .where(eq(creditLedger.userId, userId))
    .all();
}

async function useOwnOllama(userId: number) {
  await db
    .update(userSettings)
    .set({ aiProvider: "ollama", aiOllamaUrl: OWN_OLLAMA })
    .where(eq(userSettings.userId, userId));
}

async function spendAll(userId: number) {
  creditBalance(userId);
  await db.insert(creditLedger).values({ userId, amount: -CREDITS_FREE_GRANT, kind: "message" });
}

async function askWeb(userId: number) {
  session = { userId, email: "web@heycapy.test" };
  const res = await chatPOST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    })
  );
  const lines = (await res.text()).split("\n").filter((l) => l.trim());
  return lines.map((l) => JSON.parse(l) as { type: string; error?: string; text?: string });
}

it("a hosted user without a key gets free credits and pays one per answer", async () => {
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  aiReplies = [answer];

  await say("hello", chat);

  expect(aiCalls).toEqual([`${SERVER_OLLAMA}/api/chat`]);
  expect(telegramTexts.at(-1)).toContain("done");
  expect(ledger(userId)).toEqual([
    { amount: CREDITS_FREE_GRANT, kind: "grant" },
    { amount: -1, kind: "message" },
  ]);
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT - 1);
});

it("a failed answer gives the credit back", async () => {
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  aiReplies = ["fail"];

  await say("hello", chat);

  expect(telegramTexts.at(-1)).toContain("capy couldn't answer");
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
  expect(ledger(userId).map((r) => r.kind)).toEqual(["grant", "message", "refund"]);
});

it("out of credits: capy says so and never calls the AI", async () => {
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  await spendAll(userId);

  await say("hello", chat);
  const events = await askWeb(userId);

  expect(aiCalls).toEqual([]);
  expect(telegramTexts.at(-1)).toBe(OUT_OF_CREDITS_ERROR);
  expect(events).toContainEqual({ type: "error", error: OUT_OF_CREDITS_ERROR });
  expect(creditBalance(userId)).toBe(0);
});

it("web chat charges an answer and refunds a failed one", async () => {
  const userId = await seedUser();
  aiReplies = [answer];
  expect(await askWeb(userId)).toContainEqual({ type: "reply", text: "done" });
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT - 1);

  aiReplies = ["fail"];
  expect((await askWeb(userId)).map((e) => e.type)).toContain("error");
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT - 1);
});

it("the user's own AI costs no credits and its status is recorded", async () => {
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  await useOwnOllama(userId);

  aiReplies = [answer];
  await say("hello", chat);
  expect(aiCalls).toEqual([`${OWN_OLLAMA}/api/chat`]);
  expect(await getAIStatus(userId)).toMatchObject({
    kind: "own",
    status: "working",
    error: null,
    credits: CREDITS_FREE_GRANT,
  });

  aiReplies = ["fail"];
  await say("hello again", chat);
  expect(await getAIStatus(userId)).toMatchObject({
    kind: "own",
    status: "failed",
    error: expect.any(String),
  });
  expect(ledger(userId)).toEqual([{ amount: CREDITS_FREE_GRANT, kind: "grant" }]);
});

it("self-hosted servers keep no ledger", async () => {
  vi.stubEnv("HOSTED", "");
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  aiReplies = [answer];

  await say("hello", chat);

  expect(aiCalls).toEqual([`${SERVER_OLLAMA}/api/chat`]);
  expect(ledger(userId)).toEqual([]);
  expect(await getAIStatus(userId)).toEqual({ kind: "server", provider: "ollama" });
});

it("hosted: a provider picked without a key still answers on our AI, never our key elsewhere", () => {
  vi.stubEnv("AI_PROVIDER", "groq");
  vi.stubEnv("AI_API_KEY", "server-key");
  expect(getAIProvider({ provider: "anthropic", model: "claude-opus-4-1" }).meta).toEqual({
    provider: "groq",
    model: "server-model",
    key: "server",
  });
  expect(getAIProvider({ provider: "anthropic", apiKey: "user-key" }).meta.key).toBe("own");
});

it("two messages at once can't spend the same last credit", async () => {
  const userId = await seedUser();
  creditBalance(userId);
  await db
    .insert(creditLedger)
    .values({ userId, amount: -(CREDITS_FREE_GRANT - 1), kind: "message" });

  const first = holdMessageCredit(userId);
  expect(first).toEqual(expect.any(Number));
  expect(holdMessageCredit(userId)).toBeNull();
  expect(creditBalance(userId)).toBe(0);
});

it("a message is refunded at most once", async () => {
  const userId = await seedUser();
  const hold = holdMessageCredit(userId);
  if (!hold) throw new Error("no hold");

  refundMessageCredit(hold);
  refundMessageCredit(hold);

  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
});

it("the free credits are given once", async () => {
  const userId = await seedUser();
  creditBalance(userId);
  creditBalance(userId);
  holdMessageCredit(userId);
  expect(ledger(userId).filter((r) => r.kind === "grant")).toHaveLength(1);
});

it("admins give and take credits, never below zero", async () => {
  vi.stubEnv("ADMIN_EMAILS", "admin@heycapy.test");
  const userId = await seedUser();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("no user");
  session = { userId, email: "admin@heycapy.test" };

  const given = await adjustUserCreditsAction({
    email: user.email.toUpperCase(),
    amount: 25,
    note: "beta tester",
  });
  expect(given).toMatchObject({ ok: true, credits: { balance: CREDITS_FREE_GRANT + 25 } });

  expect(await adjustUserCreditsAction({ email: user.email, amount: -1000, note: "" })).toEqual({
    ok: false,
    error: `they only have ${CREDITS_FREE_GRANT + 25} credits to take`,
  });
  expect(await adjustUserCreditsAction({ email: user.email, amount: 1.5, note: "" })).toEqual({
    ok: false,
    error: "amount must be a whole number",
  });

  const looked = await getUserCreditsAction(user.email);
  expect(looked.ok && looked.credits.rows[0]).toMatchObject({
    amount: 25,
    kind: "admin",
    note: "beta tester",
    actor: "admin@heycapy.test",
  });
  expect(adjustCredits(userId, -(CREDITS_FREE_GRANT + 25), null, "admin@heycapy.test").ok).toBe(
    true
  );
});

it("only admins on a hosted server can change credits", async () => {
  vi.stubEnv("ADMIN_EMAILS", "admin@heycapy.test");
  const userId = await seedUser();
  session = { userId, email: "someone@heycapy.test" };
  expect(await getUserCreditsAction("someone@heycapy.test")).toEqual({
    ok: false,
    error: "Not allowed",
  });

  vi.stubEnv("HOSTED", "");
  session = { userId, email: "admin@heycapy.test" };
  expect(await getUserCreditsAction("someone@heycapy.test")).toMatchObject({ ok: false });
});

it("the ledger is in the data export and goes with the account", async () => {
  const userId = await seedUser();
  const hold = holdMessageCredit(userId);
  if (!hold) throw new Error("no hold");
  refundMessageCredit(hold);

  const exported = await buildAccountExport(userId);
  expect(exported.credits.map((c) => c.kind)).toEqual(["grant", "message", "refund"]);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  deleteAccount(userId, user?.email ?? "");
  expect(ledger(userId)).toEqual([]);
});

it("heycapy ai keeps the saved key but answers on our AI with credits", async () => {
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  await db
    .update(userSettings)
    .set({ aiProvider: "gemini", aiApiKey: encryptValue("user-gemini-key"), aiUseOwnKey: false })
    .where(eq(userSettings.userId, userId));
  aiReplies = [answer];

  await say("hello", chat);

  expect(aiCalls).toEqual([`${SERVER_OLLAMA}/api/chat`]);
  expect(await getAIStatus(userId)).toEqual({ kind: "credits", balance: CREDITS_FREE_GRANT - 1 });
});
