import { OLLAMA_REQUEST_TIMEOUT_MS } from "@/constants";
import { postJson } from "@/lib/notifications/post-json";
import type { AIProvider, AgentMessage, CompleteResult, Message, TokenUsage, Tool } from "../types";

type OllamaToolCall = {
  function: { name: string; arguments: Record<string, unknown> };
};

type OllamaMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: OllamaToolCall[] }
  | { role: "tool"; content: string };

type OllamaCompleteResponse = {
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: OllamaToolCall[];
  };
  prompt_eval_count?: number;
  eval_count?: number;
};

function ollamaUsage(data: OllamaCompleteResponse): TokenUsage {
  if (data.prompt_eval_count === undefined && data.eval_count === undefined) return null;
  return {
    inputTokens: data.prompt_eval_count ?? 0,
    outputTokens: data.eval_count ?? 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

async function postChat(
  baseUrl: string,
  body: object,
  userTyped: boolean
): Promise<OllamaCompleteResponse> {
  const url = `${baseUrl}/api/chat`;
  const payload = JSON.stringify({ ...body, stream: false });
  // a url a user typed in only goes to a public address on hosted servers, see postJson
  if (userTyped) {
    const { status, text } = await postJson(new URL(url), payload, {}, OLLAMA_REQUEST_TIMEOUT_MS);
    if (status < 200 || status >= 300) throw new Error(`Ollama error: ${status}`);
    return JSON.parse(text) as OllamaCompleteResponse;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
  });
  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as OllamaCompleteResponse;
}

function toOllamaMessage(m: AgentMessage): OllamaMessage {
  if (m.role === "tool") {
    return { role: "tool", content: m.content };
  }
  if (m.role === "assistant") {
    if (m.toolCalls?.length) {
      return {
        role: "assistant",
        content: m.content,
        tool_calls: m.toolCalls.map((tc) => ({
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: "assistant", content: m.content };
  }
  return { role: m.role, content: m.content };
}

export function createOllamaProvider(
  baseUrl: string,
  model: string,
  userTyped = false
): AIProvider {
  return {
    async chat(messages: Message[]) {
      const data = await postChat(baseUrl, { model, messages }, userTyped);
      return { text: data.message.content ?? "", usage: ollamaUsage(data) };
    },

    async complete(messages: AgentMessage[], tools: Tool[]): Promise<CompleteResult> {
      const ollamaMessages = messages.map(toOllamaMessage);
      const ollamaTools = tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));

      const data = await postChat(
        baseUrl,
        { model, messages: ollamaMessages, tools: ollamaTools },
        userTyped
      );
      const usage = ollamaUsage(data);
      const msg = data.message;

      if (msg.tool_calls?.length) {
        return {
          content: msg.content,
          toolCalls: msg.tool_calls.map((tc) => ({
            id: crypto.randomUUID(),
            name: tc.function.name,
            arguments: tc.function.arguments,
          })),
          usage,
        };
      }

      return { content: msg.content, toolCalls: [], usage };
    },
  };
}
