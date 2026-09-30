import type OpenAI from "openai";
import type { TokenUsage } from "../types";

export function openAIUsage(usage: OpenAI.CompletionUsage | undefined): TokenUsage {
  return usage ? { inputTokens: usage.prompt_tokens, outputTokens: usage.completion_tokens } : null;
}
