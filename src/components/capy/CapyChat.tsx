"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Sprite } from "./Sprite";
import { useUIStore } from "@/store/ui";
import { useChatStream } from "./useChatStream";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInputBar } from "./ChatInputBar";
import { CapyChatHeader } from "./CapyChatHeader";
import { DEFAULT_W, DEFAULT_H, HEADER_H } from "./chatTypes";
import type { Pos } from "./chatTypes";

export function CapyChat() {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const openChat = useUIStore((s) => s.openChat);
  const closeChat = useUIStore((s) => s.closeChat);
  const toggleChat = useUIStore((s) => s.toggleChat);

  const [minimized, setMinimized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);

  const { messages, input, setInput, streaming, sendMessage, stopStreaming } = useChatStream();

  useEffect(() => {
    const id = setTimeout(() => {
      setPos({
        x: window.innerWidth - DEFAULT_W - 24,
        y: window.innerHeight - DEFAULT_H - 24,
      });
    }, 0);
    return () => clearTimeout(id);
  }, []);

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

  function startDrag(e: React.PointerEvent) {
    if (!pos || fullscreen) return;
    e.preventDefault();
    const ox = e.clientX - pos.x;
    const oy = e.clientY - pos.y;

    function onMove(ev: PointerEvent) {
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - DEFAULT_W, ev.clientX - ox)),
        y: Math.max(0, Math.min(window.innerHeight - HEADER_H, ev.clientY - oy)),
      });
    }
    function onUp() {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }

  if (!pos) return null;

  const bodyH = DEFAULT_H - HEADER_H;

  const panelStyle = fullscreen
    ? { position: "fixed" as const, inset: 8, zIndex: 50, boxShadow: "5px 5px 0 var(--border)" }
    : {
        position: "fixed" as const,
        left: pos.x,
        top: pos.y,
        width: DEFAULT_W,
        zIndex: 50,
        boxShadow: "5px 5px 0 var(--border)",
      };

  const body = (
    <>
      <ChatMessageList messages={messages} streaming={streaming} fullscreen={fullscreen} />
      <ChatInputBar
        input={input}
        setInput={setInput}
        streaming={streaming}
        onSend={() => void sendMessage()}
        onStop={stopStreaming}
      />
    </>
  );

  return (
    <>
      <AnimatePresence>
        {!chatOpen && (
          <motion.button
            key="bubble"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "fixed",
              left: pos.x,
              top: pos.y,
              zIndex: 50,
              boxShadow: "3px 3px 0 var(--border)",
            }}
            onClick={openChat}
            className="border-border bg-background hover:bg-card flex items-center gap-2 border-2 px-3 py-2 transition-colors"
            aria-label="Open Capy chat"
          >
            <Sprite id="capy-idle-blink" size={28} />
            <span className="font-pixel text-[10px]">capy</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatOpen && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={panelStyle}
            className={cn("border-border bg-background flex flex-col border-2")}
          >
            <CapyChatHeader
              fullscreen={fullscreen}
              minimized={minimized}
              onDragStart={startDrag}
              onMinimize={() => setMinimized((m) => !m)}
              onFullscreen={() => {
                setFullscreen((f) => !f);
                setMinimized(false);
              }}
              onClose={closeChat}
            />

            {fullscreen ? (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
            ) : (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: minimized ? 0 : bodyH }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex flex-col overflow-hidden"
              >
                {body}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
