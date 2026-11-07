import { TextButton } from "@/components/ui/TextButton";
import { CloseButton } from "@/components/ui/CloseButton";
import { HEADER_H } from "./chatTypes";
import { useAssistantName } from "./assistant-name";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";

type Props = {
  fullscreen: boolean;
  minimized: boolean;
  onClose: () => void;
  closeHidden?: boolean;
  onMinimize?: () => void;
  onFullscreen?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onHistoryOpen: () => void;
  onNewChat: () => void;
};

export function CapyChatHeader({
  fullscreen,
  minimized,
  onClose,
  closeHidden,
  onMinimize,
  onFullscreen,
  sidebarOpen,
  onToggleSidebar,
  onHistoryOpen,
  onNewChat,
}: Props) {
  const name = useAssistantName();
  return (
    <div
      style={{ height: HEADER_H }}
      className={cn(
        "border-border bg-card border-b-frame flex items-center gap-1 px-2 select-none",
        onMinimize && "cursor-pointer"
      )}
      onClick={onMinimize}
    >
      {fullscreen && onToggleSidebar && (
        <IconButton
          icon={sidebarOpen ? "sidebar-close" : "sidebar-open"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSidebar();
          }}
          aria-label={sidebarOpen ? "Hide history" : "Show history"}
          aria-expanded={sidebarOpen}
          className="flex h-6 w-6 items-center justify-center"
        />
      )}

      <span className="font-display flex-1 truncate pl-1 text-xs">{name}</span>

      {!fullscreen && (
        <TextButton
          icon="clock"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onHistoryOpen();
          }}
          className="px-1"
        >
          history
        </TextButton>
      )}

      <TextButton
        icon="plus"
        iconLabel="new chat"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onNewChat();
        }}
        className="px-1"
      >
        new
      </TextButton>

      {onMinimize && !fullscreen && (
        <IconButton
          icon="minus"
          onClick={(e) => {
            e.stopPropagation();
            onMinimize();
          }}
          className="flex h-6 w-6 items-center justify-center"
          aria-label={minimized ? "Expand" : "Collapse"}
        />
      )}
      {onFullscreen && (
        <IconButton
          icon={fullscreen ? "collapse" : "expand"}
          onClick={(e) => {
            e.stopPropagation();
            onFullscreen();
          }}
          className="flex h-6 w-6 items-center justify-center"
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        />
      )}
      <span className={cn(closeHidden && "sr-only")}>
        <CloseButton
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label="close chat"
          className="px-1"
        />
      </span>
    </div>
  );
}
