import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { LookupAddress } from "node:dns";
import type * as dnsPromises from "node:dns/promises";
import type * as TiersModule from "@/lib/ai/tiers";
import type * as PostJsonModule from "@/lib/notifications/post-json";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { OLLAMA_REQUEST_TIMEOUT_MS } from "@/constants";
import { checkAIKeyAction } from "@/app/(app)/ai-status-actions";
import { updateUserSettingsAction } from "@/app/(app)/user-settings-actions";
import { publicAddress } from "@/lib/notifications/public-address";
import { connectOwnChat, say } from "./telegram-helpers";
import { seedUser } from "./helpers";

let session: { userId: number; email: string } | null = null;
vi.mock("@/lib/auth/session", () => ({
  getSession: async () => session,
  deleteSession: async () => {},
}));

// our quick tier answers from a stand in ollama so no test reaches a real provider
vi.mock("@/lib/ai/tiers", async (importOriginal) => {
  const tiers = await importOriginal<typeof TiersModule>();
  const primary = {
    provider: "ollama" as const,
    model: "server-model",
    price: { input: 1, cachedInput: 0.1, output: 2 },
  };
  return { ...tiers, serverTiers: () => ({ ...tiers.AI_TIERS, quick: { primary } }) };
});

const fakeDns = vi.hoisted(() => new Map<string, LookupAddress[]>());
vi.mock("node:dns/promises", async (importOriginal) => {
  const real = await importOriginal<typeof dnsPromises>();
  return {
    ...real,
    lookup: async (name: string, options: { all: true }) =>
      fakeDns.get(name) ?? real.lookup(name, options),
  };
});

// a user's ollama goes through postJson: the real address check runs, then it answers from
// here with the address it would have connected to instead of opening a connection
type OllamaCall = { url: string; pinnedTo: string | null; timeoutMs: number | undefined };
const ollamaCalls = vi.hoisted(() => [] as OllamaCall[]);
vi.mock("@/lib/notifications/post-json", async (importOriginal) => {
  const real = await importOriginal<typeof PostJsonModule>();
  return {
    ...real,
    postJson: async (url: URL, _body: string, _headers: unknown, timeoutMs?: number) => {
      const pinned = await publicAddress(url.hostname);
      ollamaCalls.push({ url: url.href, pinnedTo: pinned?.address ?? null, timeoutMs });
      return {
        status: 200,
        text: JSON.stringify({ message: { role: "assistant", content: "hi from your ollama" } }),
      };
    },
  };
});

const INTERNAL = "http://127.0.0.1:9";
const PUBLIC_OLLAMA = "http://ollama.example.test:11434";
const SERVER_OLLAMA = "http://server-ollama.test";
let requested: string[] = [];
let telegramTexts: string[] = [];

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  vi.stubEnv("HOSTED", "true");
  vi.stubEnv("AI_PROVIDER", "ollama");
  vi.stubEnv("OLLAMA_URL", SERVER_OLLAMA);
  fakeDns.set("ollama.example.test", [{ address: "93.184.215.14", family: 4 }]);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      requested.push(String(url));
      if (String(url).startsWith(SERVER_OLLAMA)) {
        return new Response(JSON.stringify({ message: { role: "assistant", content: "ok" } }));
      }
      const body = init?.body ? (JSON.parse(String(init.body)) as { text?: string }) : {};
      if (body.text) telegramTexts.push(body.text);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    })
  );
});
afterEach(() => {
  requested = [];
  telegramTexts = [];
  ollamaCalls.length = 0;
  fakeDns.clear();
  session = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function useOllama(userId: number, url: string) {
  await db
    .update(userSettings)
    .set({ aiProvider: "ollama", aiOllamaUrl: url })
    .where(eq(userSettings.userId, userId));
}

it("a hosted server reaches a user's ollama on a public address, pinned to the one it checked", async () => {
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  await useOllama(userId, PUBLIC_OLLAMA);

  await say("hello", chat);

  expect(ollamaCalls).toEqual([
    {
      url: `${PUBLIC_OLLAMA}/api/chat`,
      pinnedTo: "93.184.215.14",
      timeoutMs: OLLAMA_REQUEST_TIMEOUT_MS,
    },
  ]);
  expect(requested.filter((u) => u.startsWith(SERVER_OLLAMA))).toEqual([]);
  expect(telegramTexts.join("\n")).toContain("hi from your ollama");
});

it("a hosted server never reaches a user's ollama on a private address", async () => {
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  await useOllama(userId, INTERNAL);

  await say("hello", chat);

  expect(ollamaCalls).toEqual([]);
  expect(telegramTexts.join("\n")).toContain("points to a private network");
});

it("the key check refuses a private address without reaching it", async () => {
  const userId = await seedUser();
  session = { userId, email: "someone@heycapy.test" };
  await useOllama(userId, INTERNAL);

  expect(await checkAIKeyAction()).toMatchObject({
    ok: true,
    status: { kind: "own", status: "failed" },
  });
  expect(ollamaCalls).toEqual([]);
});

it("saving an ollama url on a private address is refused, a public one is fine", async () => {
  const userId = await seedUser();
  session = { userId, email: "someone@heycapy.test" };
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  if (!settings) throw new Error("no settings");
  const save = (aiOllamaUrl: string) =>
    updateUserSettingsAction({
      ...settings,
      aiKeyEdits: {},
      transcriptionKeyEdit: { newKey: null, clear: false },
      aiProvider: "ollama",
      aiOllamaUrl,
      smtpPass: null,
      smtpSecure: false,
    });

  expect(await save(INTERNAL)).toEqual({
    ok: false,
    error: "127.0.0.1 points to a private network. use a public server",
  });
  expect(await save("ftp://ollama.example.test")).toEqual({
    ok: false,
    error: "ollama url is not valid",
  });
  expect(await save(PUBLIC_OLLAMA)).toMatchObject({ ok: true });
});

it("self-hosted servers use the user's own ollama on any address", async () => {
  vi.stubEnv("HOSTED", "");
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  await useOllama(userId, INTERNAL);

  await say("hello", chat);

  expect(ollamaCalls).toEqual([
    { url: `${INTERNAL}/api/chat`, pinnedTo: null, timeoutMs: OLLAMA_REQUEST_TIMEOUT_MS },
  ]);
});
