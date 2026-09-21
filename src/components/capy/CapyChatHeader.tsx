import { GripVertical, Maximize2, Minimize, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sprite } from "./Sprite";
import { HEADER_H } from "./chatTypes";

type Props = {
  fullscreen: boolean;
  minimized: boolean;
  onDragStart: (e: React.PointerEvent) => void;
  onMinimize: () => void;
  onFullscreen: () => void;
  onClose: () => void;
};

export function CapyChatHeader({
  fullscreen,
  minimized,
  onDragStart,
  onMinimize,
  onFullscreen,
  onClose,
}: Props) {
  return (
    <div
      style={{ height: HEADER_H }}
      className="border-border bg-card flex items-center gap-1 border-b-2 px-2 select-none"
    >
      <div
        onPointerDown={onDragStart}
        className={cn(
          "flex items-center gap-1 pr-1",
          fullscreen ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        )}
        title={fullscreen ? undefined : "drag to move"}
      >
        <GripVertical size={12} className="text-muted-foreground shrink-0" />
        <Sprite id="capy-idle-blink" size={24} />
      </div>

      <span className="font-pixel flex-1 text-[11px]">capy</span>

      {!fullscreen && (
        <button
          onClick={onMinimize}
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          aria-label={minimized ? "Expand" : "Minimize"}
        >
          <Minimize size={12} />
        </button>
      )}
      <button
        onClick={onFullscreen}
        className="text-muted-foreground hover:text-foreground p-1 transition-colors"
        aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
      >
        {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
      </button>
      <button
        onClick={onClose}
        className="text-muted-foreground hover:text-foreground p-1 transition-colors"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}
