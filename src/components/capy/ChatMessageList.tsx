import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Sprite } from "./Sprite";
import { ChatMarkdown } from "./ChatMarkdown";
import type { ChatMessage } from "./chatTypes";

type Props = {
  messages: ChatMessage[];
  streaming: boolean;
  status?: string | null;
  fullscreen?: boolean;
  appUrl: string | null;
};

function BouncingDots() {
  return (
    <span className="flex items-end gap-0.5 py-0.5">
      <span
        className="bg-muted-foreground/60 h-1 w-1 animate-bounce rounded-full"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="bg-muted-foreground/60 h-1 w-1 animate-bounce rounded-full"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="bg-muted-foreground/60 h-1 w-1 animate-bounce rounded-full"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}

export function ChatMessageList({ messages, streaming, status, fullscreen, appUrl }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const isLastStreaming = (msg: ChatMessage) => streaming && msg.id === messages.at(-1)?.id;

  return (
    <div
      ref={listRef}
      className="scrollbar-hide flex flex-1 flex-col overflow-y-auto overscroll-contain p-3"
    >
      <div className={cn("flex flex-col gap-3", fullscreen && "mx-auto w-full max-w-[720px]")}>
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
                "flex w-full flex-col gap-1",
                msg.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "w-fit px-3 py-2 font-mono text-xs leading-relaxed break-words",
                  fullscreen ? "max-w-[65ch]" : "max-w-[85%]",
                  msg.role === "user"
                    ? "bg-foreground text-background"
                    : "border-border bg-card text-card-foreground border"
                )}
              >
                {!msg.content && isLastStreaming(msg) ? (
                  <span className="flex items-center gap-2">
                    <BouncingDots />
                    {status && (
                      <span
                        role="status"
                        aria-label="capy is working"
                        className="text-muted-foreground text-[11px]"
                      >
                        {status}…
                      </span>
                    )}
                  </span>
                ) : msg.role === "assistant" ? (
                  <ChatMarkdown content={msg.content} appUrl={appUrl} />
                ) : (
                  msg.content
                )}
              </div>
              {msg.stopped && (
                <span className="text-muted-foreground font-mono text-[11px]">— stopped</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
