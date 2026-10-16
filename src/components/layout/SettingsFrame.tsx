import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import { ACCENT_BUTTONS } from "./settings-constants";

type SettingsFrameProps = {
  open: boolean;
  onRequestClose: () => void;
  children: ReactNode;
};

export function SettingsFrame({ open, onRequestClose, children }: SettingsFrameProps) {
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
            onClick={onRequestClose}
          />
          <motion.aside
            key="sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={cn(
              "bg-background border-border fixed top-0 right-0 z-[60] flex h-full w-full flex-col border-l-2 sm:w-80",
              ACCENT_BUTTONS
            )}
            style={{ boxShadow: "-4px 0 0 var(--border)" }}
          >
            <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
              <span className="font-pixel text-xs">tweaks</span>
              <BracketButton variant="inverted" onClick={onRequestClose}>
                x
              </BracketButton>
            </div>
            {children}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
