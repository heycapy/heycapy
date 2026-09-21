"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useDragControls, useMotionValue } from "framer-motion";
import { ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sprite } from "./Sprite";
import { useUIStore } from "@/store/ui";
import type { Message } from "@/lib/ai/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content: "Hi there, am capy... how can I help you today?",
};

export function CapyChat() {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const openChat = useUIStore((s) => s.openChat);
  const closeChat = useUIStore((s) => s.closeChat);
  const toggleChat = useUIStore((s) => s.toggleChat);

  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        toggleChat();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleChat]);

  useEffect(() => {
    if (chatOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [chatOpen]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setStreaming(true);

    const apiMessages: Message[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) throw new Error(`Chat error: ${res.status}`);

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
      if (err instanceof Error && err.name === "AbortError") return;
      setMessages((prev) => {
        const last = prev.at(-1);
        if (!last) return prev;
        return [...prev.slice(0, -1), { ...last, content: "Something went wrong. Try again." }];
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  const isLastStreaming = (msg: ChatMessage) => streaming && msg.id === messages.at(-1)?.id;

  return (
    <>
      {!chatOpen && (
        <motion.button
          drag
          dragMomentum={false}
          style={{
            x,
            y,
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 50,
            boxShadow: "3px 3px 0 var(--border)",
          }}
          onClick={openChat}
          className="border-border bg-background hover:bg-card flex cursor-grab items-center gap-2 border-2 px-3 py-2 transition-colors active:cursor-grabbing"
          aria-label="Open Capy chat"
        >
          <Sprite id="capy-idle-blink" size={28} />
          <span className="font-pixel text-[10px]">capy</span>
        </motion.button>
      )}

      {chatOpen && (
        <motion.div
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          style={{
            x,
            y,
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 50,
            width: 308,
            boxShadow: "5px 5px 0 var(--border)",
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="border-border bg-background flex flex-col border-2"
        >
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="border-border bg-card flex cursor-grab items-center gap-2 border-b-2 px-3 py-2 select-none active:cursor-grabbing"
          >
            <Sprite id="capy-idle-blink" size={24} />
            <span className="font-pixel flex-1 text-[11px]">capy</span>
            <button
              onClick={closeChat}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Minimize"
            >
              <Minus size={12} />
            </button>
          </div>

          <div className="scrollbar-hide flex h-72 flex-col gap-3 overflow-y-auto p-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex gap-2", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 self-end">
                    {isLastStreaming(msg) ? (
                      <Sprite id="capy-thinking" size={20} />
                    ) : (
                      <Sprite id="capy-mascot" size={20} />
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[220px] px-2.5 py-2 font-mono text-xs leading-relaxed",
                    msg.role === "user"
                      ? "bg-foreground text-background"
                      : "border-border bg-card text-card-foreground border"
                  )}
                >
                  {msg.content || <span className="text-muted-foreground animate-pulse">...</span>}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-border flex items-end gap-2 border-t-2 px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ask capy..."
              rows={1}
              disabled={streaming}
              className="scrollbar-hide placeholder:text-muted-foreground flex-1 resize-none bg-transparent font-mono text-xs outline-none disabled:opacity-50"
              style={{ maxHeight: 72 }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 72)}px`;
              }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || streaming}
              className={cn(
                "border-border mb-0.5 shrink-0 border p-1 transition-colors",
                input.trim() && !streaming
                  ? "bg-foreground text-background"
                  : "text-muted-foreground cursor-not-allowed"
              )}
              aria-label="Send"
            >
              <ArrowUp size={12} />
            </button>
          </div>
        </motion.div>
      )}
    </>
  );
}
