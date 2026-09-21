import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Sprite } from "./Sprite";
import type { ChatMessage } from "./chatTypes";

type Props = {
  messages: ChatMessage[];
  streaming: boolean;
};

export function ChatMessageList({ messages, streaming }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isLastStreaming = (msg: ChatMessage) => streaming && msg.id === messages.at(-1)?.id;

  return (
    <div className="scrollbar-hide flex flex-1 flex-col gap-3 overflow-y-auto p-3">
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
            className={cn("flex flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}
          >
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
            {msg.stopped && (
              <span className="text-muted-foreground font-mono text-[9px]">— stopped</span>
            )}
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
