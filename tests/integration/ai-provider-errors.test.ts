import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createOpenAIProvider } from "@/lib/ai/providers/openai";
import { createAnthropicProvider } from "@/lib/ai/providers/anthropic";
import { parseProviderError } from "@/lib/errors";

const GROQ_LIMIT =
  "Rate limit reached for model `openai/gpt-oss-120b` on tokens per minute (TPM): Limit 8000, Used 7400, Requested 5400. Please try again in 36.7s.";

let server: Server;
let baseUrl = "";
let requests = 0;
let reply: { status: number; body: unknown } = { status: 429, body: {} };

beforeAll(async () => {
  server = createServer((req, res) => {
    requests += 1;
    req.resume();
    res.writeHead(reply.status, { "content-type": "application/json", "retry-after": "20" });
    res.end(JSON.stringify(reply.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => {
  vi.unstubAllEnvs();
  requests = 0;
});

async function failure(call: () => Promise<unknown>) {
  const started = Date.now();
  const err = await call().then(
    () => null,
    (e: unknown) => e
  );
  return { err, ms: Date.now() - started };
}

describe("a rate limit from the provider", () => {
  it("OpenAI-style (Groq, Gemini, OpenAI): shows the provider's message at once, no silent retry", async () => {
    vi.stubEnv("OPENAI_BASE_URL", baseUrl);
    reply = { status: 429, body: { error: { message: GROQ_LIMIT, type: "tokens" } } };
    const provider = createOpenAIProvider("key", "openai/gpt-oss-120b");

    const { err, ms } = await failure(() =>
      provider.complete([{ role: "user", content: "hi" }], [])
    );

    expect(parseProviderError(err)).toBe(GROQ_LIMIT);
    expect(requests).toBe(1);
    expect(ms).toBeLessThan(5_000);
  });

  it("Anthropic: shows the provider's message at once, no silent retry", async () => {
    vi.stubEnv("ANTHROPIC_BASE_URL", baseUrl);
    reply = {
      status: 429,
      body: { type: "error", error: { type: "rate_limit_error", message: "Too many tokens." } },
    };
    const provider = createAnthropicProvider("key", "claude-sonnet-4-6");

    const { err, ms } = await failure(() =>
      provider.complete([{ role: "user", content: "hi" }], [])
    );

    expect(parseProviderError(err)).toBe("Too many tokens.");
    expect(requests).toBe(1);
    expect(ms).toBeLessThan(5_000);
  });
});
