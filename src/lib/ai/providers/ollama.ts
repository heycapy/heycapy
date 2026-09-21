import type { AIProvider, Message } from "../types";

type OllamaChunk = {
  message?: { content: string };
  done: boolean;
};

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
  };
}
