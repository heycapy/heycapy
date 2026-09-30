import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";
import { runAgent } from "@/lib/ai/runAgent";
import { seedUser } from "./helpers";

const fake = vi.hoisted(() => ({ base: "" }));
vi.mock("@/constants", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    get GEMINI_API_BASE() {
      return fake.base;
    },
  };
});

const SIGNED = { google: { thought_signature: "signature-from-gemini" } };

let server: Server;
const bodies: { messages: Record<string, unknown>[] }[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk: Buffer) => (raw += chunk.toString()));
    req.on("end", () => {
      bodies.push(JSON.parse(raw) as { messages: Record<string, unknown>[] });
      const message =
        bodies.length === 1
          ? {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call-1",
                  type: "function",
                  function: { name: "list_buckets", arguments: "{}" },
                  extra_content: SIGNED,
                },
              ],
            }
          : { role: "assistant", content: "you have no buckets yet" };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({ id: "r", object: "chat.completion", choices: [{ index: 0, message }] })
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  fake.base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

it("sends Gemini's thought signature back with the tool call it came on", async () => {
  const userId = await seedUser();

  const reply = await runAgent({
    provider: createGeminiProvider("key", "gemini-3-flash"),
    messages: [{ role: "user", content: "what buckets do I have?" }],
    userId,
    timezone: "UTC",
    timeoutMs: 5_000,
  });

  expect(reply).toBe("you have no buckets yet");
  const replayed = bodies[1]?.messages.find((m) => m.role === "assistant") as
    { tool_calls?: { extra_content?: unknown }[] } | undefined;
  expect(replayed?.tool_calls?.[0]?.extra_content).toEqual(SIGNED);
});
