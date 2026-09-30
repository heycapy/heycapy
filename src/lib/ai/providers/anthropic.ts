import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AgentMessage, CompleteResult, Message, TokenUsage, Tool } from "../types";
import { AI_CLIENT_OPTIONS } from "./options";

function toAnthropicMessages(messages: AgentMessage[]): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];
  const nonSystem = messages.filter((m) => m.role !== "system");
  let i = 0;

  while (i < nonSystem.length) {
    const m = nonSystem[i];

    if (m.role === "user") {
      result.push({ role: "user", content: m.content });
      i++;
    } else if (m.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      result.push({
        role: "assistant",
        content: content.length === 1 && content[0]?.type === "text" ? (m.content ?? "") : content,
      });
      i++;
    } else if (m.role === "tool") {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      while (i < nonSystem.length && nonSystem[i].role === "tool") {
        const t = nonSystem[i] as { role: "tool"; toolCallId: string; content: string };
        toolResults.push({ type: "tool_result", tool_use_id: t.toolCallId, content: t.content });
        i++;
      }
      result.push({ role: "user", content: toolResults });
    } else {
      i++;
    }
  }

  return result;
}

// input_tokens leaves out the prompt tokens read from or written to the cache
function anthropicUsage(usage: Anthropic.Usage): TokenUsage {
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
  return {
    inputTokens: usage.input_tokens + cacheReadTokens + cacheWriteTokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens,
    cacheWriteTokens,
  };
}

export function createAnthropicProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey, ...AI_CLIENT_OPTIONS });

  return {
    async chat(messages: Message[]) {
      const systemMessages = messages.filter((m) => m.role === "system");
      const chatMessages = messages.filter((m) => m.role !== "system");

      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemMessages.map((m) => m.content).join("\n") || undefined,
        messages: chatMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      return {
        text: response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join(""),
        usage: anthropicUsage(response.usage),
      };
    },

    async complete(messages: AgentMessage[], tools: Tool[]): Promise<CompleteResult> {
      const systemMessages = messages.filter((m) => m.role === "system");
      const system = systemMessages.map((m) => m.content).join("\n") || undefined;
      const anthropicMessages = toAnthropicMessages(messages);

      // The tools are the same for every user and message, so they get their own cache point;
      // below the model's minimum cacheable length the API just skips it
      const anthropicTools: Anthropic.Tool[] = tools.map((t, i) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
        ...(i === tools.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
      }));

      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        // Caches the whole request, so each tool round of an answer reads the rounds before it
        cache_control: { type: "ephemeral" },
        system,
        messages: anthropicMessages,
        tools: anthropicTools,
      });

      const usage = anthropicUsage(response.usage);
      const textContent = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (toolUseBlocks.length > 0) {
        return {
          content: textContent || null,
          toolCalls: toolUseBlocks.map((b) => ({
            id: b.id,
            name: b.name,
            arguments: b.input as Record<string, unknown>,
          })),
          usage,
        };
      }

      return { content: textContent || null, toolCalls: [], usage };
    },
  };
}
