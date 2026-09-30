import { AGENT_MAX_ROUNDS, AI_TIMEOUT_ERROR } from "@/constants";
import { CAPY_TOOLS, executeToolCall } from "./capyTools";
import type { AgentMessage, AIProvider, CompleteResult, TokenUsage, ToolCall } from "./types";

export type AgentStep = { kind: "thinking" } | { kind: "tool"; call: ToolCall };

type RunAgentOptions = {
  provider: AIProvider;
  messages: AgentMessage[];
  userId: number;
  timezone: string;
  timeoutMs: number;
  onStep?: (step: AgentStep) => void;
  onUsage?: (usage: TokenUsage) => void;
};

async function completeWithin(
  provider: AIProvider,
  messages: AgentMessage[],
  timeoutMs: number
): Promise<CompleteResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    provider.complete(messages, CAPY_TOOLS),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(AI_TIMEOUT_ERROR)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

// Calls the model, runs the tools it asks for and repeats until it answers; throws the provider's error
export async function runAgent({
  provider,
  messages,
  userId,
  timezone,
  timeoutMs,
  onStep,
  onUsage,
}: RunAgentOptions): Promise<string> {
  let lastContent = "";
  for (let round = 0; round < AGENT_MAX_ROUNDS; round++) {
    // After tools, their line stays up while the model reads the results; a fresh "thinking" would hide it
    if (round === 0) onStep?.({ kind: "thinking" });
    const result = await completeWithin(provider, messages, timeoutMs);
    onUsage?.(result.usage);
    if (result.content) lastContent = result.content;
    if (result.toolCalls.length === 0) return result.content || lastContent;

    messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });
    for (const call of result.toolCalls) {
      onStep?.({ kind: "tool", call });
      messages.push({
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
        content: await executeToolCall(call, userId, timezone),
      });
    }
  }
  return lastContent;
}
