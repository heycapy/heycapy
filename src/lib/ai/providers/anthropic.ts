import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, Message } from "../types";

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
  };
}
