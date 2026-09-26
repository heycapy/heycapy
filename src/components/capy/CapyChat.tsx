"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useChatStream } from "./useChatStream";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInputBar, type ChatInputBarHandle } from "./ChatInputBar";
import { CapyChatHeader } from "./CapyChatHeader";
import { ChatHistorySheet } from "./ChatHistorySheet";
import { Sprite } from "./Sprite";
import { DEFAULT_H, HEADER_H } from "./chatTypes";

type ChatState = "closed" | "open" | "minimized" | "fullscreen";

export function CapyChat() {
  const [chatState, setChatState] = useState<ChatState>("closed");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const inputBarRef = useRef<ChatInputBarHandle>(null);
  const prevChatStateRef = useRef<ChatState>(chatState);

  const {
    messages,
    input,
    setInput,
    streaming,
    sendMessage,
    stopStreaming,
    clearChat,
    loadSession,
  } = useChatStream();

  useEffect(() => {
    const prev = prevChatStateRef.current;
    prevChatStateRef.current = chatState;
    if (chatState === "open" && (prev === "closed" || prev === "minimized")) {
      const delay = prev === "minimized" ? 210 : 0;
      const timer = setTimeout(() => inputBarRef.current?.focus(), delay);
      return () => clearTimeout(timer);
    }
  }, [chatState]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setChatState((s) => {
          if (s === "closed" || s === "minimized") return "open";
          return "minimized";
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (chatState === "closed") {
    return (
      <button
        onClick={() => setChatState("open")}
        className="fixed right-6 bottom-6 z-50 transition-transform hover:scale-110 active:scale-95"
        aria-label="Open chat"
      >
        <Sprite id="capy-idle-blink" size={44} />
      </button>
    );
  }

  const bodyH = DEFAULT_H - HEADER_H;

  const panelClassName = cn(
    "border-border bg-background flex flex-col border-2 fixed z-50",
    chatState === "fullscreen"
      ? "inset-2"
      : cn(
          "bottom-0 inset-x-0 md:inset-x-auto md:right-6 md:w-[308px]",
          isMobile && chatState !== "minimized" && "h-[52svh] overflow-hidden"
        )
  );

  const body = (
    <>
      <ChatMessageList
        messages={messages}
        streaming={streaming}
        fullscreen={chatState === "fullscreen"}
      />
      <ChatInputBar
        ref={inputBarRef}
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
      <motion.div style={{ boxShadow: "5px 5px 0 var(--border)" }} className={panelClassName}>
        <CapyChatHeader
          fullscreen={chatState === "fullscreen"}
          minimized={chatState === "minimized"}
          onClose={() => setChatState("closed")}
          onMinimize={() => setChatState((s) => (s === "minimized" ? "open" : "minimized"))}
          onFullscreen={() => setChatState((s) => (s === "fullscreen" ? "open" : "fullscreen"))}
          onHistoryOpen={() => setHistoryOpen(true)}
          onNewChat={clearChat}
        />

        {chatState === "fullscreen" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{body}</div>
        ) : isMobile ? (
          <div
            className={cn(
              "flex flex-col overflow-hidden transition-[height] duration-200 ease-in-out",
              chatState === "minimized" ? "h-0" : "min-h-0 flex-1"
            )}
          >
            {body}
          </div>
        ) : (
          <motion.div
            initial={false}
            animate={{ height: chatState === "minimized" ? 0 : bodyH }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex flex-col overflow-hidden"
          >
            {body}
          </motion.div>
        )}
      </motion.div>

      <ChatHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onLoadSession={loadSession}
        onNewChat={clearChat}
      />
    </>
  );
}
