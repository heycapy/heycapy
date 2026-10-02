import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type * as TiersModule from "@/lib/ai/tiers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userSettings } from "@/lib/db/schema";
import { checkAIKeyAction } from "@/app/(app)/ai-status-actions";
import { updateUserSettingsAction } from "@/app/(app)/user-settings-actions";
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

const INTERNAL = "http://127.0.0.1:9";
const SERVER_OLLAMA = "http://server-ollama.test";
let requested: string[] = [];

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = "test-token";
  vi.stubEnv("HOSTED", "true");
  vi.stubEnv("AI_PROVIDER", "ollama");
  vi.stubEnv("OLLAMA_URL", SERVER_OLLAMA);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request) => {
      requested.push(String(url));
      if (String(url).startsWith(SERVER_OLLAMA) || String(url).startsWith(INTERNAL)) {
        return new Response(JSON.stringify({ message: { role: "assistant", content: "ok" } }));
      }
      return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
    })
  );
});
afterEach(() => {
  requested = [];
  session = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("a hosted server never fetches an ollama url a user typed in", async () => {
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  await db
    .update(userSettings)
    .set({ aiProvider: "ollama", aiOllamaUrl: INTERNAL })
    .where(eq(userSettings.userId, userId));

  await say("hello", chat);

  expect(requested.filter((u) => u.startsWith(INTERNAL))).toEqual([]);
  expect(requested).toContain(`${SERVER_OLLAMA}/api/chat`);
});

it("the key check doesn't fetch it either, and saving ollama is refused", async () => {
  const userId = await seedUser();
  session = { userId, email: "someone@heycapy.test" };
  await db
    .update(userSettings)
    .set({ aiProvider: "ollama", aiOllamaUrl: INTERNAL })
    .where(eq(userSettings.userId, userId));

  expect(await checkAIKeyAction()).toMatchObject({ ok: true, status: { kind: "credits" } });
  expect(requested).toEqual([]);

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });
  if (!settings) throw new Error("no settings");
  expect(
    await updateUserSettingsAction({
      ...settings,
      aiKeyEdits: {},
      transcriptionKeyEdit: { newKey: null, clear: false },
      aiProvider: "ollama",
      aiOllamaUrl: INTERNAL,
      smtpPass: null,
      smtpSecure: false,
    })
  ).toEqual({ ok: false, error: "Ollama isn't available here. Pick another provider." });
});

it("self-hosted servers still use the user's own ollama", async () => {
  vi.stubEnv("HOSTED", "");
  const userId = await seedUser();
  const chat = await connectOwnChat(userId);
  await db
    .update(userSettings)
    .set({ aiProvider: "ollama", aiOllamaUrl: INTERNAL })
    .where(eq(userSettings.userId, userId));

  await say("hello", chat);

  expect(requested).toContain(`${INTERNAL}/api/chat`);
});
