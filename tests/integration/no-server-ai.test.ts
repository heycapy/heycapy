import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAIProvider, hasServerAI } from "@/lib/ai";
import { aiStatusFor } from "@/lib/ai/status";
import { aiStatusIsProblem, aiStatusLabel } from "@/lib/ai/status-label";
import { NO_AI_ERROR } from "@/constants";
import type { userSettings } from "@/lib/db/schema";

type SettingsRow = typeof userSettings.$inferSelect;
// the add-key dropdown starts on ollama, so a user who never set anything up has it without a url
const NOTHING_SET_UP = { aiProvider: "ollama" } as SettingsRow;

beforeEach(() => {
  vi.stubEnv("HOSTED", "");
  vi.stubEnv("AI_PROVIDER", "");
  vi.stubEnv("AI_API_KEY", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("a self-hosted server without an ai in .env", () => {
  it("tells users without their own ai what's missing instead of a provider error", () => {
    expect(hasServerAI()).toBe(false);
    expect(() => getAIProvider({ provider: "ollama" })).toThrow(NO_AI_ERROR);
    expect(() => getAIProvider()).toThrow(NO_AI_ERROR);
  });

  it("still uses a user's own key", () => {
    expect(getAIProvider({ provider: "groq", apiKey: "user-key" }).meta.key).toBe("own");
  });

  it("shows as no ai set up, as a problem", () => {
    const status = aiStatusFor(1, NOTHING_SET_UP);
    expect(status).toEqual({ kind: "none" });
    expect(aiStatusLabel(status)).toBe("no ai set up");
    expect(aiStatusIsProblem(status)).toBe(true);
  });
});

describe("the server ai in .env", () => {
  it("needs a key, except for ollama", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(hasServerAI()).toBe(false);
    vi.stubEnv("AI_API_KEY", "server-key");
    expect(hasServerAI()).toBe(true);
    vi.stubEnv("AI_PROVIDER", "ollama");
    vi.stubEnv("AI_API_KEY", "");
    expect(hasServerAI()).toBe(true);
  });

  it("answers users without their own ai", () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("AI_API_KEY", "server-key");
    expect(getAIProvider({ provider: "ollama" }).meta).toMatchObject({
      provider: "gemini",
      key: "server",
    });
    expect(aiStatusFor(1, NOTHING_SET_UP)).toEqual({ kind: "server", provider: "gemini" });
  });
});
