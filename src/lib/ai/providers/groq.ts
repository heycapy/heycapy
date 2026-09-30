import OpenAI from "openai";
import { GROQ_API_BASE } from "@/constants";
import type { AIProvider, AgentMessage, CompleteResult, Message, Tool } from "../types";
import { AI_CLIENT_OPTIONS } from "./options";

export function createGroqProvider(apiKey: string, model: string): AIProvider {
  const client = new OpenAI({ apiKey, baseURL: GROQ_API_BASE, ...AI_CLIENT_OPTIONS });

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

    async complete(messages: AgentMessage[], tools: Tool[]): Promise<CompleteResult> {
      const oaiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      for (const m of messages) {
        if (m.role === "tool") {
          oaiMessages.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
        } else if (m.role === "assistant") {
          if (m.toolCalls?.length) {
            oaiMessages.push({
              role: "assistant",
              content: m.content,
              tool_calls: m.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
              })),
            });
          } else {
            oaiMessages.push({ role: "assistant", content: m.content ?? "" });
          }
        } else {
          oaiMessages.push({ role: m.role, content: m.content });
        }
      }

      const oaiTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map((t) => ({
        type: "function" as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));

      const response = await client.chat.completions.create({
        model,
        messages: oaiMessages,
        tools: oaiTools,
      });

      const msg = response.choices[0]?.message;

      const functionCalls = (msg?.tool_calls ?? []).filter(
        (
          tc
        ): tc is { id: string; type: "function"; function: { name: string; arguments: string } } =>
          tc.type === "function"
      );

      if (functionCalls.length > 0) {
        return {
          content: msg?.content ?? null,
          toolCalls: functionCalls.map((tc) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
          })),
        };
      }

      return { content: msg?.content ?? null, toolCalls: [] };
    },
  };
}
