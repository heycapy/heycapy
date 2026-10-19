import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useChatStream } from "./useChatStream";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInputBar, type ChatInputBarHandle } from "./ChatInputBar";
import { CapyChatHeader } from "./CapyChatHeader";
import { ChatHistorySheet } from "./ChatHistorySheet";
import { ChatSessionList } from "./ChatSessionList";
import { CapyChatDrawer } from "./CapyChatDrawer";
import { Sprite } from "./Sprite";
import { AIStatusStrip } from "./AIStatusStrip";
import { DEFAULT_H, HEADER_H } from "./chatTypes";
import { useLayoutStore, type ChatState } from "@/store/layout";

export function CapyChat() {
  const chatState = useLayoutStore((s) => s.chatState);
  const setChatState = useLayoutStore((s) => s.setChatState);
  const bottomBarShown = useLayoutStore((s) => s.bottomBarShown);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    status,
    sendMessage,
    stopStreaming,
    clearChat,
    loadSession,
    sessionId,
  } = useChatStream();

  useEffect(() => {
    const prev = prevChatStateRef.current;
    prevChatStateRef.current = chatState;
    if (isMobile) return;
    if (chatState === "open" && (prev === "closed" || prev === "minimized")) {
      const delay = prev === "minimized" ? 210 : 0;
      const timer = setTimeout(() => inputBarRef.current?.focus(), delay);
      return () => clearTimeout(timer);
    }
  }, [chatState, isMobile]);

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
  }, [setChatState]);

  const trigger = (
    <button
      onClick={() => setChatState("open")}
      className={cn(
        "fixed right-6 bottom-6 z-50 transition-transform hover:scale-110 active:scale-95",
        bottomBarShown && "max-md:hidden"
      )}
      aria-label="Open chat"
    >
      <Sprite id="capy-idle-blink" size={44} />
    </button>
  );

  const bodyH = DEFAULT_H - HEADER_H;

  const panelClassName = cn(
    "border-border bg-background flex flex-col border-2 fixed z-50",
    chatState === "fullscreen" ? "inset-2" : "right-6 bottom-0 w-[308px]"
  );

  const fullscreen = chatState === "fullscreen";
  const centered = (node: ReactNode) =>
    fullscreen ? <div className="mx-auto w-full max-w-[720px]">{node}</div> : node;

  const inputBar = (
    <ChatInputBar
      ref={inputBarRef}
      input={input}
      setInput={setInput}
      streaming={streaming}
      onSend={() => void sendMessage()}
      onStop={stopStreaming}
      boxed={!isMobile}
    />
  );

  const body = (
    <>
      {centered(<AIStatusStrip />)}
      <ChatMessageList
        messages={messages}
        streaming={streaming}
        status={status}
        fullscreen={fullscreen}
      />
      {isMobile ? inputBar : <div className="px-3 pb-3">{centered(inputBar)}</div>}
    </>
  );

  const history = (
    <ChatHistorySheet
      open={historyOpen}
      activeId={sessionId}
      onClose={() => setHistoryOpen(false)}
      onLoadSession={loadSession}
      onNewChat={clearChat}
    />
  );

  if (isMobile) {
    return (
      <>
        {chatState === "closed" && trigger}
        <CapyChatDrawer
          open={chatState !== "closed"}
          onClose={() => setChatState("closed")}
          header={
            <CapyChatHeader
              fullscreen={false}
              minimized={false}
              onClose={() => setChatState("closed")}
              onHistoryOpen={() => setHistoryOpen(true)}
              onNewChat={clearChat}
            />
          }
        >
          {body}
          {history}
        </CapyChatDrawer>
      </>
    );
  }

  if (chatState === "closed") return trigger;

  return (
    <>
      <motion.div style={{ boxShadow: "5px 5px 0 var(--border)" }} className={panelClassName}>
        <CapyChatHeader
          fullscreen={chatState === "fullscreen"}
          minimized={chatState === "minimized"}
          onClose={() => setChatState("closed")}
          onMinimize={() => setChatState((s) => (s === "minimized" ? "open" : "minimized"))}
          onFullscreen={() => setChatState((s) => (s === "fullscreen" ? "open" : "fullscreen"))}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
          onHistoryOpen={() => setHistoryOpen(true)}
          onNewChat={clearChat}
        />

        {chatState === "fullscreen" ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            {sidebarOpen && (
              <aside
                aria-label="chat history"
                className="border-border bg-card flex w-72 shrink-0 flex-col border-r-2"
              >
                <ChatSessionList
                  enabled
                  refreshKey={`${sessionId}-${streaming}`}
                  activeId={sessionId}
                  onLoadSession={loadSession}
                  onNewChat={clearChat}
                />
              </aside>
            )}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">{body}</div>
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

      {history}
    </>
  );
}
