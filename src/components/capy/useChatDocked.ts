import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useLayoutStore } from "@/store/layout";
import { CHAT_DOCK_MEDIA_QUERY } from "@/constants";

export function useChatDocked(): { canDock: boolean; docked: boolean } {
  const canDock = useMediaQuery(CHAT_DOCK_MEDIA_QUERY);
  const open = useLayoutStore((s) => s.chatState === "open");
  return { canDock, docked: canDock && open };
}
