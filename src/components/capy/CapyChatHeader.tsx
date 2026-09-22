import { History, Maximize2, Minimize2, Minus, SquarePen, X } from "lucide-react";
import { Sprite } from "./Sprite";
import { HEADER_H } from "./chatTypes";

type Props = {
  fullscreen: boolean;
  minimized: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onFullscreen: () => void;
  onHistoryOpen: () => void;
  onNewChat: () => void;
};

export function CapyChatHeader({
  fullscreen,
  minimized,
  onClose,
  onMinimize,
  onFullscreen,
  onHistoryOpen,
  onNewChat,
}: Props) {
  return (
    <div
      style={{ height: HEADER_H }}
      className="border-border bg-card flex items-center gap-1 border-b-2 px-2 select-none"
    >
      <div className="flex items-center gap-1 pr-1">
        <Sprite id="capy-idle-blink" size={24} />
      </div>

      <span className="font-pixel flex-1 text-[11px]">capy</span>

      <button
        onClick={onHistoryOpen}
        className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center transition-colors"
        aria-label="Chat history"
      >
        <History size={13} />
      </button>

      <button
        onClick={onNewChat}
        className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center transition-colors"
        aria-label="New chat"
      >
        <SquarePen size={13} />
      </button>

      {!fullscreen && (
        <button
          onClick={onMinimize}
          className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center transition-colors"
          aria-label={minimized ? "Expand" : "Collapse"}
        >
          <Minus size={13} />
        </button>
      )}
      <button
        onClick={onFullscreen}
        className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center transition-colors"
        aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </button>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X size={13} />
      </button>
    </div>
  );
}
