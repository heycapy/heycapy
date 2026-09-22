import { createOllamaProvider } from "./providers/ollama";
import { createOpenAIProvider } from "./providers/openai";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGroqProvider } from "./providers/groq";
import { createGeminiProvider } from "./providers/gemini";
import { OLLAMA_DEFAULT_URL } from "@/constants";
import type { AIProvider } from "./types";

type AIConfig = {
  provider?: string | null;
  model?: string | null;
  apiKey?: string | null;
  ollamaUrl?: string | null;
};

export function getAIProvider(config?: AIConfig): AIProvider {
  const provider = config?.provider ?? process.env.AI_PROVIDER ?? "ollama";

  switch (provider) {
    case "ollama":
      return createOllamaProvider(
        config?.ollamaUrl ?? process.env.OLLAMA_URL ?? OLLAMA_DEFAULT_URL,
        config?.model ?? process.env.AI_MODEL ?? "llama3.2"
      );
    case "openai": {
      const key = config?.apiKey ?? process.env.AI_API_KEY;
      if (!key) throw new Error("API key is required for openai provider");
      return createOpenAIProvider(key, config?.model ?? process.env.AI_MODEL ?? "gpt-4o");
    }
    case "anthropic": {
      const key = config?.apiKey ?? process.env.AI_API_KEY;
      if (!key) throw new Error("API key is required for anthropic provider");
      return createAnthropicProvider(
        key,
        config?.model ?? process.env.AI_MODEL ?? "claude-sonnet-4-6"
      );
    }
    case "groq": {
      const key = config?.apiKey ?? process.env.AI_API_KEY;
      if (!key) throw new Error("API key is required for groq provider");
      return createGroqProvider(
        key,
        config?.model ?? process.env.AI_MODEL ?? "llama-3.3-70b-versatile"
      );
    }
    case "gemini": {
      const key = config?.apiKey ?? process.env.AI_API_KEY;
      if (!key) throw new Error("API key is required for gemini provider");
      return createGeminiProvider(key, config?.model ?? process.env.AI_MODEL ?? "gemini-2.0-flash");
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export type { AIProvider, Message } from "./types";
