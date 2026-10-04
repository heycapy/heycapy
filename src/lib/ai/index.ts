import { createOllamaProvider } from "./providers/ollama";
import { createOpenAIProvider } from "./providers/openai";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGroqProvider } from "./providers/groq";
import { createGeminiProvider } from "./providers/gemini";
import { GEMINI_DEFAULT_MODEL, NO_AI_ERROR, OLLAMA_DEFAULT_URL } from "@/constants";
import type { AIProvider } from "./types";
import type { UsageMeta } from "./usage";
import { isHosted } from "@/lib/credits";
import { PROVIDER_KEY_ENV, providerKey, serverTiers } from "./tiers";

export type AIConfig = {
  provider?: string | null;
  model?: string | null;
  apiKey?: string | null;
  ollamaUrl?: string | null;
  useOwnKey?: boolean | null;
};

export type MeteredProvider = AIProvider & { meta: UsageMeta };

const DEFAULT_MODELS: Record<string, string> = {
  ollama: "llama3.2",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-6",
  groq: "openai/gpt-oss-120b",
  gemini: GEMINI_DEFAULT_MODEL,
};

function createProvider(
  provider: string,
  model: string,
  apiKey: string | null,
  ollamaUrl: string,
  userTyped = false
): AIProvider {
  if (provider === "ollama") return createOllamaProvider(ollamaUrl, model, userTyped);
  if (!apiKey) throw new Error(`API key is required for ${provider} provider`);
  switch (provider) {
    case "openai":
      return createOpenAIProvider(apiKey, model);
    case "anthropic":
      return createAnthropicProvider(apiKey, model);
    case "groq":
      return createGroqProvider(apiKey, model);
    case "gemini":
      return createGeminiProvider(apiKey, model);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export function hasOwnAI(config?: AIConfig): boolean {
  if (!config?.provider) return false;
  if (isHosted() && config.useOwnKey === false) return false;
  // on a hosted server a user's ollama is only reached on a public address, see postJson
  if (config.provider === "ollama") return !!config.ollamaUrl;
  return !!config.apiKey;
}

// Self-hosted only: the ai in .env for users without their own; ollama needs no key
export function hasServerAI(): boolean {
  const provider = process.env.AI_PROVIDER;
  if (!provider) return false;
  return provider === "ollama" || !!process.env.AI_API_KEY;
}

export function getAIProvider(requested?: AIConfig): MeteredProvider {
  if (isHosted() && !hasOwnAI(requested)) {
    const { provider, model, price } = serverTiers().quick.primary;
    // for ollama this is its url
    const key = providerKey(provider);
    if (!key) throw new Error(`${PROVIDER_KEY_ENV[provider]} is not set`);
    return {
      ...createProvider(provider, model, key, key),
      meta: { provider, model, key: "server", price },
    };
  }

  const own = hasOwnAI(requested) && requested ? requested : null;
  if (!own && !hasServerAI()) throw new Error(NO_AI_ERROR);
  const provider = own?.provider || process.env.AI_PROVIDER || "ollama";
  const model = (own ? own.model : process.env.AI_MODEL) || DEFAULT_MODELS[provider] || "";
  const ollamaUrl = (own ? own.ollamaUrl : process.env.OLLAMA_URL) || OLLAMA_DEFAULT_URL;
  const apiKey = (own ? own.apiKey : process.env.AI_API_KEY) || null;
  return {
    ...createProvider(provider, model, apiKey, ollamaUrl, !!own),
    meta: { provider, model, key: own ? "own" : "server" },
  };
}

export type { AIProvider, Message } from "./types";
