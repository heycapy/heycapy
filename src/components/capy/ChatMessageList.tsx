import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Sprite } from "./Sprite";
import type { ChatMessage } from "./chatTypes";

type Props = {
  messages: ChatMessage[];
  streaming: boolean;
  fullscreen?: boolean;
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

export function ChatMessageList({ messages, streaming, fullscreen }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scrolls only the list: scrollIntoView also scrolled the phone drawer around it
  useEffect(() => {
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const isLastStreaming = (msg: ChatMessage) => streaming && msg.id === messages.at(-1)?.id;

  return (
    <div
      ref={listRef}
      className="scrollbar-hide flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3"
    >
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
                <BouncingDots />
              ) : msg.role === "assistant" ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                    ul: ({ children }) => (
                      <ul className="mb-1.5 list-disc pl-3 last:mb-0">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-1.5 list-decimal pl-3 last:mb-0">{children}</ol>
                    ),
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    pre: ({ children }) => (
                      <pre className="bg-muted my-1.5 overflow-x-auto rounded p-1.5 text-xs">
                        {children}
                      </pre>
                    ),
                    code: ({ children }) => (
                      <code className="bg-muted rounded px-0.5">{children}</code>
                    ),
                    strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
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
  );
}
