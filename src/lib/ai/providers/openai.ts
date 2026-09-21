import OpenAI from "openai";
import type { AIProvider, Message } from "../types";

export function createOpenAIProvider(apiKey: string, model: string): AIProvider {
  const client = new OpenAI({ apiKey });

  return {
    async *chat(messages: Message[]) {
      const stream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) yield content;
      }
    },
  };
}
