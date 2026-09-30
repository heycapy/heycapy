import { createPortal } from "react-dom";
import { useEffect, type ReactNode, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";

type ItemPageFrameProps = {
  open: boolean;
  heading: string;
  scrollBodyRef: RefObject<HTMLDivElement | null>;
  confirm: ReactNode;
  secondary: ReactNode;
  children: ReactNode;
  onCancel: () => void;
};

export function ItemPageFrame({
  open,
  heading,
  scrollBodyRef,
  confirm,
  secondary,
  children,
  onCancel,
}: ItemPageFrameProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="bg-background fixed inset-0 z-[60] flex flex-col"
        >
          <div className="border-border flex shrink-0 items-center justify-center border-b-2 px-2 pt-[env(safe-area-inset-top)]">
            <span className="font-pixel py-3.5 text-xs">{heading}</span>
          </div>

          <div
            ref={scrollBodyRef}
            className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4"
          >
            {children}
            {secondary}
          </div>

          <div className="border-border flex shrink-0 items-center justify-between border-t-2 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <BracketButton onClick={onCancel} className="px-2 py-3 text-base">
              cancel
            </BracketButton>
            {confirm}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
