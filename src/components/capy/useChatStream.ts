import { useRef, useState, createElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sprite } from "./Sprite";
import type { Message } from "@/lib/ai/types";
import { useUIStore } from "@/store/ui";
import { useChatStore } from "@/store/chat";
import { GREETING } from "./chatTypes";

export function useChatStream() {
  const router = useRouter();
  const tickAiRefresh = useUIStore((s) => s.tickAiRefresh);

  const messages = useChatStore((s) => s.messages);
  const sessionId = useChatStore((s) => s.sessionId);
  const setSessionId = useChatStore((s) => s.setSessionId);
  const setMessages = useChatStore((s) => s.setMessages);
  const appendChunkToLast = useChatStore((s) => s.appendChunkToLast);
  const markLastStopped = useChatStore((s) => s.markLastStopped);
  const markLastError = useChatStore((s) => s.markLastError);
  const clearChat = useChatStore((s) => s.clearChat);
  const loadSession = useChatStore((s) => s.loadSession);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { id: crypto.randomUUID(), role: "user" as const, content: text };
    const assistantMsg = { id: crypto.randomUUID(), role: "assistant" as const, content: "" };

    setMessages([...messages, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    const apiMessages: Message[] = [...messages, userMsg]
      .filter((m) => m.id !== GREETING.id)
      .map((m) => ({ role: m.role, content: m.content }));

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

      if (!res.ok) {
        const body = (await res
          .json()
          .catch(() => ({ error: "AI provider error. Please try again." }))) as { error: string };
        throw new Error(body.error);
      }

      if (!res.body) throw new Error("No response body from server.");

      const rawSessionId = res.headers.get("X-Session-Id");
      if (rawSessionId) {
        setSessionId(parseInt(rawSessionId, 10));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        appendChunkToLast(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        aborted = true;
        markLastStopped();
        return;
      }
      const errMsg = err instanceof Error ? err.message : "Something went wrong.";
      toast.error("oops, ran into a problem", {
        description: errMsg,
        icon: createElement(Sprite, { id: "capy-error", size: 28 }),
      });
      markLastError();
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
