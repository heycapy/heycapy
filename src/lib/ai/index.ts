import { createOllamaProvider } from "./providers/ollama";
import { createOpenAIProvider } from "./providers/openai";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGroqProvider } from "./providers/groq";
import { createGeminiProvider } from "./providers/gemini";
import { GEMINI_DEFAULT_MODEL, OLLAMA_DEFAULT_URL } from "@/constants";
import type { AIProvider } from "./types";
import type { UsageMeta } from "./usage";
import { isHosted } from "@/lib/credits";

export type AIConfig = {
  provider?: string | null;
  model?: string | null;
  apiKey?: string | null;
  ollamaUrl?: string | null;
  useOwnKey?: boolean | null;
};

export type MeteredProvider = AIProvider & { meta: UsageMeta };

function requireKey(config: AIConfig | undefined, provider: string): string {
  const key = config?.apiKey || process.env.AI_API_KEY;
  if (!key) throw new Error(`API key is required for ${provider} provider`);
  return key;
}

export function hasOwnAI(config?: AIConfig): boolean {
  if (!config?.provider) return false;
  if (isHosted() && config.useOwnKey === false) return false;
  return config.provider === "ollama" ? !!config.ollamaUrl : !!config.apiKey;
}

export function getAIProvider(requested?: AIConfig): MeteredProvider {
  // hosted users without their own key always get our configured ai and never another provider on our key
  const config = isHosted() && !hasOwnAI(requested) ? undefined : requested;
  const provider = config?.provider || process.env.AI_PROVIDER || "ollama";
  const key = config?.apiKey ? "own" : "server";

  switch (provider) {
    case "ollama": {
      const model = config?.model || process.env.AI_MODEL || "llama3.2";
      return {
        ...createOllamaProvider(
          config?.ollamaUrl || process.env.OLLAMA_URL || OLLAMA_DEFAULT_URL,
          model
        ),
        meta: { provider, model, key: config?.ollamaUrl ? "own" : "server" },
      };
    }
    case "openai": {
      const model = config?.model || process.env.AI_MODEL || "gpt-4o";
      return {
        ...createOpenAIProvider(requireKey(config, provider), model),
        meta: { provider, model, key },
      };
    }
    case "anthropic": {
      const model = config?.model || process.env.AI_MODEL || "claude-sonnet-4-6";
      return {
        ...createAnthropicProvider(requireKey(config, provider), model),
        meta: { provider, model, key },
      };
    }
    case "groq": {
      const model = config?.model || process.env.AI_MODEL || "openai/gpt-oss-120b";
      return {
        ...createGroqProvider(requireKey(config, provider), model),
        meta: { provider, model, key },
      };
    }
    case "gemini": {
      const model = config?.model || process.env.AI_MODEL || GEMINI_DEFAULT_MODEL;
      return {
        ...createGeminiProvider(requireKey(config, provider), model),
        meta: { provider, model, key },
      };
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export type { AIProvider, Message } from "./types";
