import { Maximize2, Minimize2, Minus } from "lucide-react";
import { BracketButton } from "@/components/ui/BracketButton";
import { Sprite } from "./Sprite";
import { HEADER_H } from "./chatTypes";
import { cn } from "@/lib/utils";

type Props = {
  fullscreen: boolean;
  minimized: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onFullscreen?: () => void;
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
      className={cn(
        "border-border bg-card flex items-center gap-1 border-b-2 px-2 select-none",
        onMinimize && "cursor-pointer"
      )}
      onClick={onMinimize}
    >
      <div className="flex items-center gap-1 pr-1">
        <Sprite id="capy-idle-blink" size={24} />
      </div>

      <span className="font-pixel flex-1 text-[11px]">capy</span>

      <BracketButton
        onClick={(e) => {
          e.stopPropagation();
          onHistoryOpen();
        }}
        className="px-1"
      >
        history
      </BracketButton>

      <BracketButton
        onClick={(e) => {
          e.stopPropagation();
          onNewChat();
        }}
        className="px-1"
      >
        new
      </BracketButton>

      {onMinimize && !fullscreen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMinimize();
          }}
          className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center transition-colors"
          aria-label={minimized ? "Expand" : "Collapse"}
        >
          <Minus size={13} />
        </button>
      )}
      {onFullscreen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFullscreen();
          }}
          className="text-muted-foreground hover:text-foreground flex h-6 w-6 items-center justify-center transition-colors"
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      )}
      <BracketButton
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="close chat"
        className="px-1"
      >
        x
      </BracketButton>
    </div>
  );
}
