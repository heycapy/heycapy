import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createOpenAIProvider } from "@/lib/ai/providers/openai";
import { createGroqProvider } from "@/lib/ai/providers/groq";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";
import { createAnthropicProvider } from "@/lib/ai/providers/anthropic";
import type { AIProvider } from "@/lib/ai/types";

const fake = vi.hoisted(() => ({ base: "" }));
vi.mock("@/constants", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    get GROQ_API_BASE() {
      return fake.base;
    },
    get GEMINI_API_BASE() {
      return fake.base;
    },
  };
});

let server: Server;
let withUsage = true;

beforeAll(async () => {
  server = createServer((req, res) => {
    req.resume();
    res.writeHead(200, { "content-type": "application/json" });
    if (req.url?.endsWith("/messages")) {
      res.end(
        JSON.stringify({
          id: "msg",
          type: "message",
          role: "assistant",
          model: "claude",
          content: [{ type: "text", text: "hi" }],
          stop_reason: "end_turn",
          usage: {
            input_tokens: 10,
            cache_read_input_tokens: 5,
            cache_creation_input_tokens: 3,
            output_tokens: 7,
          },
        })
      );
      return;
    }
    res.end(
      JSON.stringify({
        id: "r",
        object: "chat.completion",
        choices: [
          { index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" },
        ],
        ...(withUsage && {
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        }),
      })
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  fake.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  vi.stubEnv("OPENAI_BASE_URL", fake.base);
  vi.stubEnv("ANTHROPIC_BASE_URL", fake.base);
});
afterAll(() => {
  vi.unstubAllEnvs();
  return new Promise<void>((resolve) => server.close(() => resolve()));
});
afterEach(() => {
  withUsage = true;
});

const openAIStyle: [string, () => AIProvider][] = [
  ["openai", () => createOpenAIProvider("key", "gpt-4o")],
  ["groq", () => createGroqProvider("key", "openai/gpt-oss-120b")],
  ["gemini", () => createGeminiProvider("key", "gemini-2.5-flash")],
];
const hello = [{ role: "user" as const, content: "hello" }];

describe.each(openAIStyle)("%s", (_, provider) => {
  it("reports the tokens of a capy call and of a summary", async () => {
    const tokens = { inputTokens: 100, outputTokens: 20 };
    expect((await provider().complete(hello, [])).usage).toEqual(tokens);
    expect(await provider().chat(hello)).toEqual({ text: "hi", usage: tokens });
  });

  it("reports nothing when the response has no usage", async () => {
    withUsage = false;
    expect((await provider().complete(hello, [])).usage).toBeNull();
  });
});

it("anthropic counts cached prompt tokens as input", async () => {
  const provider = createAnthropicProvider("key", "claude-sonnet-4-6");
  const tokens = { inputTokens: 18, outputTokens: 7 };

  expect((await provider.complete(hello, [])).usage).toEqual(tokens);
  expect(await provider.chat(hello)).toEqual({ text: "hi", usage: tokens });
});
