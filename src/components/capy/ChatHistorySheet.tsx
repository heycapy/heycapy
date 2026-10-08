import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import type { ChatMessage } from "./chatTypes";
import { ChatSessionList } from "./ChatSessionList";

type Props = {
  open: boolean;
  activeId: number | null;
  onClose: () => void;
  onLoadSession: (id: number, msgs: ChatMessage[]) => void;
  onNewChat: () => void;
};

export function ChatHistorySheet({ open, activeId, onClose, onLoadSession, onNewChat }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[55] bg-black"
            onClick={onClose}
          />
          <motion.aside
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="bg-background border-border fixed top-0 right-0 z-[60] flex h-full w-full flex-col border-l-2 sm:w-80"
            style={{ boxShadow: "-4px 0 0 var(--border)" }}
          >
            <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
              <span className="font-pixel text-xs">chat history</span>
              <BracketButton variant="inverted" onClick={onClose}>
                x
              </BracketButton>
            </div>

            <ChatSessionList
              enabled={open}
              activeId={activeId}
              onLoadSession={onLoadSession}
              onNewChat={onNewChat}
              onDone={onClose}
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
