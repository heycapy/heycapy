import type OpenAI from "openai";
import type { TokenUsage } from "../types";

export function openAIUsage(usage: OpenAI.CompletionUsage | undefined): TokenUsage {
  if (!usage) return null;
  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    cacheReadTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    cacheWriteTokens: usage.prompt_tokens_details?.cache_write_tokens ?? 0,
  };
}
