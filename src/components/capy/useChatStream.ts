import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Message } from "@/lib/ai/types";
import { useUIStore } from "@/store/ui";
import { GREETING } from "./chatTypes";
import type { ChatMessage } from "./chatTypes";

export function useChatStream() {
  const router = useRouter();
  const tickAiRefresh = useUIStore((s) => s.tickAiRefresh);

  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    const apiMessages: Message[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const abort = new AbortController();
    abortRef.current = abort;

    let aborted = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, sessionId }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Chat error: ${res.status}`);

      const rawSessionId = res.headers.get("X-Session-Id");
      if (rawSessionId) {
        setSessionId(parseInt(rawSessionId, 10));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const last = prev.at(-1);
          if (!last) return prev;
          return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        aborted = true;
        setMessages((prev) => {
          const last = prev.at(-1);
          if (!last) return prev;
          return [...prev.slice(0, -1), { ...last, stopped: true }];
        });
        return;
      }
      setMessages((prev) => {
        const last = prev.at(-1);
        if (!last) return prev;
        return [...prev.slice(0, -1), { ...last, content: "Something went wrong. Try again." }];
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
      if (!aborted) {
        tickAiRefresh();
        router.refresh();
      }
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  function clearChat() {
    setMessages([GREETING]);
    setSessionId(null);
  }

  function loadSession(id: number, msgs: ChatMessage[]) {
    setMessages(msgs);
    setSessionId(id);
  }

  return {
    messages,
    input,
    setInput,
    streaming,
    sendMessage,
    stopStreaming,
    sessionId,
    clearChat,
    loadSession,
  };
}
