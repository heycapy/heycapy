import type { ReactNode, RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { cn } from "@/lib/utils";

export type ItemFrameProps = {
  open: boolean;
  heading: string;
  wide: boolean;
  scrollBodyRef: RefObject<HTMLDivElement | null>;
  footer: ReactNode;
  children: ReactNode;
  onCancel: () => void;
};

export function ItemDialogFrame({
  open,
  heading,
  wide,
  scrollBodyRef,
  footer,
  children,
  onCancel,
}: ItemFrameProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[55] bg-black"
            onClick={onCancel}
          />

          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "fixed top-[5%] left-1/2 z-[60] w-[calc(100%-2rem)] -translate-x-1/2",
              wide ? "max-w-md" : "max-w-sm"
            )}
            style={{ boxShadow: "5px 5px 0 var(--border)" }}
          >
            <div className="border-border bg-background flex max-h-[78vh] flex-col overflow-hidden border-2">
              <div className="bg-foreground text-background flex shrink-0 items-center justify-between px-3 py-1.5">
                <span className="font-pixel text-xs">{heading}</span>
                <BracketButton variant="inverted" onClick={onCancel}>
                  x
                </BracketButton>
              </div>

              <div
                ref={scrollBodyRef}
                className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-4"
              >
                {children}
              </div>

              <div className="border-border flex shrink-0 items-center justify-between border-t px-3 py-2.5">
                {footer}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
