import { useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  input: string;
  setInput: (v: string) => void;
  streaming: boolean;
  onSend: () => void;
  onStop: () => void;
};

export function ChatInputBar({ input, setInput, streaming, onSend, onStop }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevStreamingRef = useRef(streaming);

  useEffect(() => {
    if (prevStreamingRef.current && !streaming) {
      inputRef.current?.focus();
    }
    prevStreamingRef.current = streaming;
  }, [streaming]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
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
      {streaming ? (
        <button
          onClick={onStop}
          className="text-destructive border-destructive font-pixel mb-0.5 shrink-0 border px-1.5 py-0.5 text-[9px] transition-opacity hover:opacity-70"
          aria-label="Stop"
        >
          stop
        </button>
      ) : (
        <button
          onClick={onSend}
          disabled={!input.trim()}
          className={cn(
            "border-border mb-0.5 shrink-0 border p-1 transition-colors",
            input.trim()
              ? "bg-foreground text-background"
              : "text-muted-foreground cursor-not-allowed"
          )}
          aria-label="Send"
        >
          <ArrowUp size={12} />
        </button>
      )}
    </div>
  );
}
