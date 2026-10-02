import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getAIProvider } from "@/lib/ai";

beforeEach(() => {
  vi.stubEnv("HOSTED", "");
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("AI_MODEL", "gemini-server-model");
  vi.stubEnv("AI_API_KEY", "server-gemini-key");
});
afterEach(() => vi.unstubAllEnvs());

it("a user's own key with no model gets its provider's usual model, not the server's", () => {
  expect(getAIProvider({ provider: "openai", apiKey: "sk-user", model: null }).meta).toEqual({
    provider: "openai",
    model: "gpt-4o",
    key: "own",
  });
});

it("a user's own model is used as typed", () => {
  expect(
    getAIProvider({ provider: "openai", apiKey: "sk-user", model: "gpt-4.1-mini" }).meta.model
  ).toBe("gpt-4.1-mini");
});

it("a provider picked without a key falls back to the server's ai as a whole", () => {
  expect(getAIProvider({ provider: "openai", apiKey: null, model: "gpt-4o" }).meta).toEqual({
    provider: "gemini",
    model: "gemini-server-model",
    key: "server",
  });
});
