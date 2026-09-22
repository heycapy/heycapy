import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, AgentMessage, CompleteResult, Message, Tool } from "../types";

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

export function createAnthropicProvider(apiKey: string, model: string): AIProvider {
  const client = new Anthropic({ apiKey });

  return {
    async *chat(messages: Message[]) {
      const systemMessages = messages.filter((m) => m.role === "system");
      const chatMessages = messages.filter((m) => m.role !== "system");

      const stream = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemMessages.map((m) => m.content).join("\n") || undefined,
        messages: chatMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    },

    async complete(messages: AgentMessage[], tools: Tool[]): Promise<CompleteResult> {
      const systemMessages = messages.filter((m) => m.role === "system");
      const system = systemMessages.map((m) => m.content).join("\n") || undefined;
      const anthropicMessages = toAnthropicMessages(messages);

      const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));

      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system,
        messages: anthropicMessages,
        tools: anthropicTools,
      });

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
        };
      }

      return { content: textContent || null, toolCalls: [] };
    },
  };
}
