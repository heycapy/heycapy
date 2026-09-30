import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsage, buckets, creditLedger, userSettings } from "@/lib/db/schema";
import { encryptValue } from "@/lib/crypto";
import { creditBalance } from "@/lib/credits";
import { POST } from "@/app/api/transcribe/route";
import {
  CREDITS_FREE_GRANT,
  GEMINI_NATIVE_API_BASE,
  OUT_OF_CREDITS_ERROR,
  VOICE_MAX_BYTES,
  VOICE_NO_SPEECH_ERROR,
  VOICE_TOO_LONG_ERROR,
} from "@/constants";
import { seedUser } from "./helpers";

let session: { userId: number } | null = null;
vi.mock("@/lib/auth/session", () => ({
  requireApiSession: async () => [session, null],
}));

type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> };
let calls: Call[] = [];
let geminiReply: { status: number; body: unknown } = { status: 200, body: {} };

const transcript = (text: string, speech = true) => ({
  candidates: [{ content: { parts: [{ text: JSON.stringify({ speech, text }) }] } }],
  usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 12 },
});

beforeEach(() => {
  vi.stubEnv("HOSTED", "true");
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("AI_API_KEY", "server-gemini-key");
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  geminiReply = { status: 200, body: transcript("add dentist friday 5pm") };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(url),
        headers: init?.headers as Record<string, string>,
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response(JSON.stringify(geminiReply.body), { status: geminiReply.status });
    })
  );
});
afterEach(() => {
  calls = [];
  session = null;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function speak(userId: number, audio = new Blob(["voice"], { type: "audio/mp4" })) {
  session = { userId };
  const form = new FormData();
  form.append("audio", audio, "recording.webm");
  const res = await POST(
    new Request("http://localhost/api/transcribe", { method: "POST", body: form })
  );
  return { status: res.status, body: (await res.json()) as { text?: string; error?: string } };
}

function usageRows(userId: number) {
  return db.select().from(aiUsage).where(eq(aiUsage.userId, userId)).all();
}

it("heycapy ai users speak through our Gemini, free, and it's metered as voice", async () => {
  const userId = await seedUser();

  expect(await speak(userId)).toEqual({ status: 200, body: { text: "add dentist friday 5pm" } });

  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe(
    `${GEMINI_NATIVE_API_BASE}/models/gemini-3.5-flash-lite:generateContent`
  );
  expect(calls[0].headers["x-goog-api-key"]).toBe("server-gemini-key");
  expect(JSON.stringify(calls[0].body)).toContain('"mime_type":"audio/m4a"');
  expect(creditBalance(userId)).toBe(CREDITS_FREE_GRANT);
  expect(usageRows(userId)).toEqual([
    expect.objectContaining({
      source: "voice",
      provider: "gemini",
      model: "gemini-3.5-flash-lite",
      key: "server",
      inputTokens: 400,
      outputTokens: 12,
    }),
  ]);
});

it("voice needs credits left, stays short, and says so when the server has no voice", async () => {
  const userId = await seedUser();
  expect((await speak(userId, new Blob([new Uint8Array(VOICE_MAX_BYTES + 1)]))).body).toEqual({
    error: VOICE_TOO_LONG_ERROR,
  });

  creditBalance(userId);
  await db.insert(creditLedger).values({ userId, amount: -CREDITS_FREE_GRANT, kind: "message" });
  expect(await speak(userId)).toEqual({ status: 402, body: { error: OUT_OF_CREDITS_ERROR } });

  vi.stubEnv("AI_PROVIDER", "anthropic");
  expect((await speak(await seedUser())).status).toBe(503);
  expect(calls).toEqual([]);
});

it("Gemini's own error reaches the user", async () => {
  geminiReply = { status: 400, body: { error: { message: "API key not valid." } } };
  expect(await speak(await seedUser())).toEqual({
    status: 502,
    body: { error: "Gemini error: API key not valid." },
  });
});

it("own-key users can pick gemini for voice, on their own key", async () => {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({
      aiProvider: "gemini",
      aiApiKey: encryptValue("user-gemini-key"),
      transcriptionProvider: "gemini",
    })
    .where(eq(userSettings.userId, userId));

  expect((await speak(userId)).body).toEqual({ text: "add dentist friday 5pm" });
  expect(calls[0].headers["x-goog-api-key"]).toBe("user-gemini-key");
  expect(usageRows(userId)).toEqual([expect.objectContaining({ source: "voice", key: "own" })]);
});

it("self-hosted servers keep voice on the user's own provider", async () => {
  vi.stubEnv("HOSTED", "");
  expect((await speak(await seedUser())).status).toBe(400);
  expect(calls).toEqual([]);
});

it.each([
  ["Gemini says there was no speech", transcript("", false)],
  ["only a noise label comes back", transcript("<noise>")],
])("a recording without words says capy heard nothing: %s", async (_, reply) => {
  const userId = await seedUser();
  geminiReply = { status: 200, body: reply };

  expect(await speak(userId)).toEqual({ status: 422, body: { error: VOICE_NO_SPEECH_ERROR } });
  expect(usageRows(userId)).toHaveLength(1);
});

it("asks Gemini for a set shape and gives it the user's bucket names", async () => {
  const userId = await seedUser();
  await db.insert(buckets).values({ userId, name: "Subscriptions" });

  await speak(userId);

  const body = calls[0].body as {
    contents: { parts: { text?: string }[] }[];
    generationConfig: Record<string, unknown>;
  };
  expect(body.contents[0].parts[0].text).toContain("Names they may say: Subscriptions.");
  expect(body.generationConfig).toMatchObject({
    responseMimeType: "application/json",
    responseSchema: { required: ["speech", "text"] },
  });
});
