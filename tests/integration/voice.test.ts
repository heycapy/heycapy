import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiUsage, buckets, creditLedger, items, userSettings } from "@/lib/db/schema";
import { encryptValue } from "@/lib/crypto";
import { storeSavedAIKeys } from "@/lib/ai/saved-keys";
import { creditBalance } from "@/lib/credits";
import { POST } from "@/app/api/transcribe/route";
import {
  CREDITS_FREE_GRANT,
  GEMINI_NATIVE_API_BASE,
  OUT_OF_CREDITS_ERROR,
  VOICE_HINT_MAX_LENGTH,
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
  vi.stubEnv("GEMINI_API_KEY", "server-gemini-key");
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  geminiReply = { status: 200, body: transcript("add dentist friday 5pm") };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).startsWith("data:")) return new Response("");
      const upload = init?.body instanceof FormData ? init.body : null;
      calls.push({
        url: String(url),
        headers: init?.headers as Record<string, string>,
        body: upload
          ? Object.fromEntries([...upload.entries()].filter(([, v]) => typeof v === "string"))
          : (JSON.parse(String(init?.body)) as Record<string, unknown>),
      });
      return new Response(JSON.stringify(geminiReply.body), {
        status: geminiReply.status,
        headers: { "content-type": "application/json" },
      });
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
      // 400 × $0.30 + 12 × $2.50 per 1M tokens
      costMicros: 150,
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

  vi.stubEnv("GEMINI_API_KEY", "");
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

it("voice with no key of its own uses the key saved for its provider in chat", async () => {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({
      aiProvider: "openai",
      aiApiKey: encryptValue("sk-chat-key"),
      aiSavedKeys: storeSavedAIKeys({ groq: { apiKey: "gsk-saved-key", model: null } }),
      transcriptionProvider: "groq",
    })
    .where(eq(userSettings.userId, userId));
  geminiReply = { status: 200, body: { text: "call mom sunday" } };

  expect((await speak(userId)).body).toEqual({ text: "call mom sunday" });
  expect(calls[0].url).toContain("api.groq.com");
  expect(new Headers(calls[0].headers).get("authorization")).toBe("Bearer gsk-saved-key");
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

it("asks Gemini for a set shape, as a note to capy, with the names the user may say", async () => {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({ personalityName: "Bubbles" })
    .where(eq(userSettings.userId, userId));
  const [bucket] = await db
    .insert(buckets)
    .values({ userId, name: "Subscriptions" })
    .returning({ id: buckets.id });
  const day = 86_400_000;
  await db.insert(items).values([
    { userId, bucketId: bucket.id, title: "hotstar", deadline: new Date(Date.now() + 2 * day) },
    { userId, bucketId: bucket.id, title: "Netflix", deadline: new Date(Date.now() + day) },
    { userId, bucketId: bucket.id, title: "someday list" },
    { userId, bucketId: bucket.id, title: "old gym plan", status: "completed" },
    { userId, bucketId: bucket.id, title: "x".repeat(VOICE_HINT_MAX_LENGTH + 1) },
  ]);

  await speak(userId);

  const body = calls[0].body as {
    contents: { parts: { text?: string }[] }[];
    generationConfig: Record<string, unknown>;
  };
  const prompt = body.contents[0].parts[0].text ?? "";
  expect(prompt).toContain('a voice note to Bubbles (also "hey Bubbles")');
  expect(prompt).toContain(
    "spelled like this: capy, hey capy, heycapy, Bubbles, hey Bubbles, Subscriptions, Netflix, hotstar, someday list."
  );
  expect(body.generationConfig).toMatchObject({
    responseMimeType: "application/json",
    responseSchema: { required: ["speech", "text"] },
  });
});

it("gives Whisper the same names as a spelling list", async () => {
  const userId = await seedUser();
  await db
    .update(userSettings)
    .set({
      aiProvider: "groq",
      aiApiKey: encryptValue("user-groq-key"),
      transcriptionProvider: "groq",
    })
    .where(eq(userSettings.userId, userId));
  await db.insert(buckets).values({ userId, name: "Work" });
  geminiReply = { status: 200, body: { text: "add standup notes to work" } };

  expect((await speak(userId)).body).toEqual({ text: "add standup notes to work" });
  expect(calls[0].url).toContain("/audio/transcriptions");
  expect(calls[0].body.prompt).toBe("capy, hey capy, heycapy, Work");
});

it("heycapy's voice comes from the voice tier, not the old VOICE_ variables", async () => {
  vi.stubEnv("VOICE_PROVIDER", "groq");
  vi.stubEnv("VOICE_API_KEY", "server-groq-key");
  vi.stubEnv("VOICE_MODEL", "whisper-large-v3-turbo");

  expect((await speak(await seedUser())).status).toBe(200);
  expect(calls[0].url).toBe(
    `${GEMINI_NATIVE_API_BASE}/models/gemini-3.5-flash-lite:generateContent`
  );
  expect(calls[0].headers["x-goog-api-key"]).toBe("server-gemini-key");
});

it("voice never falls back to the chat AI's key", async () => {
  vi.stubEnv("GEMINI_API_KEY", "");
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("AI_API_KEY", "chat-gemini-key");

  expect(await speak(await seedUser())).toEqual({
    status: 503,
    body: { error: "Voice isn't set up on this server." },
  });
  expect(calls).toEqual([]);
});

it("an empty recording says nothing was heard without calling the provider", async () => {
  const userId = await seedUser();

  expect(await speak(userId, new Blob([]))).toEqual({
    status: 422,
    body: { error: VOICE_NO_SPEECH_ERROR },
  });
  expect(calls).toEqual([]);
  expect(usageRows(userId)).toEqual([]);
});

it("audio Gemini can't decode says nothing was heard, but other 400s stay errors", async () => {
  const userId = await seedUser();
  geminiReply = {
    status: 400,
    body: {
      error: {
        code: 400,
        message: "Request contains an invalid argument.",
        status: "INVALID_ARGUMENT",
      },
    },
  };
  expect(await speak(userId)).toEqual({ status: 422, body: { error: VOICE_NO_SPEECH_ERROR } });

  geminiReply = {
    status: 400,
    body: {
      error: {
        code: 400,
        message: "API key not valid. Please pass a valid API key.",
        status: "INVALID_ARGUMENT",
      },
    },
  };
  expect(await speak(userId)).toEqual({
    status: 502,
    body: { error: "Gemini error: API key not valid. Please pass a valid API key." },
  });
});
