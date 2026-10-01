import { useRef, useState, createElement } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sprite } from "./Sprite";
import type { Message } from "@/lib/ai/types";
import { useUIStore } from "@/store/ui";
import { useChatStore } from "@/store/chat";
import { GREETING } from "./chatTypes";
import type { ChatEvent } from "@/lib/ai/chatEvents";

const CONNECTION_LOST = "Lost the connection before capy answered. Try again.";

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
  const [status, setStatus] = useState<string | null>(null);
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

      let answered = false;
      const handle = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as ChatEvent;
        if (event.type === "status") setStatus(event.text);
        else if (event.type === "reply") {
          answered = true;
          setStatus(null);
          appendChunkToLast(event.text);
        } else if (event.type === "error") throw new Error(event.error);
        else if (event.sessionId) setSessionId(event.sessionId);
      };

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handle);
      }
      handle(buffer);
      if (!answered) throw new Error(CONNECTION_LOST);
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
      markLastError(errMsg);
    } finally {
      setStreaming(false);
      setStatus(null);
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
    status,
    sendMessage,
    stopStreaming,
    sessionId,
    clearChat,
    loadSession,
  };
}
