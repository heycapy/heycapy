import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { CHAT_MAX_H, CHAT_TOP_GAP, HEADER_H } from "./chatTypes";
import { FOOTER_H } from "@/constants";
import { useLayoutStore, type ChatState } from "@/store/layout";

export function CapyChat({ appUrl }: { appUrl: string | null }) {
  const chatState = useLayoutStore((s) => s.chatState);
  const setChatState = useLayoutStore((s) => s.setChatState);
  const bottomBarShown = useLayoutStore((s) => s.bottomBarShown);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [screenH, setScreenH] = useState(CHAT_MAX_H + CHAT_TOP_GAP);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 768);
      setScreenH(window.innerHeight);
    };
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
        bottomBarShown && "hidden"
      )}
      aria-label="Open chat"
    >
      <Sprite id="capy-idle-blink" size={44} />
    </button>
  );

  const below = bottomBarShown ? FOOTER_H : 0;
  const bodyH = Math.min(CHAT_MAX_H, screenH - CHAT_TOP_GAP - below) - HEADER_H;

  // Grows up out of the capy that was tapped: right above the footer's square (never over the
  // add box), or the floating one elsewhere
  const panelClassName = cn(
    "border-border bg-background flex flex-col border-2 fixed z-50 origin-bottom-right",
    chatState === "fullscreen"
      ? "inset-2"
      : bottomBarShown
        ? "right-[max(1rem,calc((100vw-var(--container-column))/2+1rem))] bottom-[calc(var(--footer-h)+0.5rem)] w-110"
        : "right-6 bottom-6 w-110"
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
        appUrl={appUrl}
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

  return (
    <>
      {chatState === "closed" && trigger}
      <AnimatePresence>
        {chatState !== "closed" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 0.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            style={{
              boxShadow: "5px 5px 0 var(--border)",
              ["--footer-h" as string]: `${FOOTER_H}px`,
            }}
            className={panelClassName}
          >
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
        )}
      </AnimatePresence>

      {history}
    </>
  );
}
