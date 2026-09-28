import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { useScrollLock } from "@/hooks/useScrollLock";
import { ItemReminderInfo } from "./ItemReminderInfo";

type ReminderInfoDialogProps = {
  itemId: number;
  title: string;
  onClose: () => void;
};

// Portalled: rows sit inside transformed containers, which break `position: fixed`
export function ReminderInfoDialog({ itemId, title, onClose }: ReminderInfoDialogProps) {
  useScrollLock(true);

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.45 }}
        transition={{ duration: 0.12 }}
        className="fixed inset-0 z-[55] bg-black"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="fixed top-[12%] left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
        style={{ boxShadow: "5px 5px 0 var(--border)" }}
      >
        <div className="border-border bg-background flex flex-col border-2">
          <div className="bg-foreground text-background flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="font-pixel min-w-0 truncate text-xs">reminder [{title}]</span>
            <BracketButton variant="inverted" onClick={onClose}>
              x
            </BracketButton>
          </div>
          <div className="px-4 py-4">
            <ItemReminderInfo itemId={itemId} />
          </div>
        </div>
      </motion.div>
    </>,
    document.body
  );
}
