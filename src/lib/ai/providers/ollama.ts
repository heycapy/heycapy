import type { AIProvider, AgentMessage, CompleteResult, Message, Tool } from "../types";

type OllamaChunk = {
  message?: { content: string };
  done: boolean;
};

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
};

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

export function createOllamaProvider(baseUrl: string, model: string): AIProvider {
  return {
    async *chat(messages: Message[]) {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line) as OllamaChunk;
            if (chunk.message?.content) yield chunk.message.content;
          } catch {
            // skip malformed lines
          }
        }
      }
    },

    async complete(messages: AgentMessage[], tools: Tool[]): Promise<CompleteResult> {
      const ollamaMessages = messages.map(toOllamaMessage);
      const ollamaTools = tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }));

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: ollamaMessages,
          tools: ollamaTools,
          stream: false,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as OllamaCompleteResponse;
      const msg = data.message;

      if (msg.tool_calls?.length) {
        return {
          content: msg.content,
          toolCalls: msg.tool_calls.map((tc) => ({
            id: crypto.randomUUID(),
            name: tc.function.name,
            arguments: tc.function.arguments,
          })),
        };
      }

      return { content: msg.content, toolCalls: [] };
    },
  };
}
