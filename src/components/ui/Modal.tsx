"use client";

import { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { BracketButton } from "./BracketButton";
import {
  MODAL_LAYERS,
  MODAL_PANELS,
  MODAL_PANEL_SELECTOR,
  POPOVER_SELECTOR,
  HANDLES_ESCAPE_SELECTOR,
  type ModalLayer,
  type ModalVariant,
} from "./constants";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  variant?: ModalVariant;
  layer?: ModalLayer;
  // only when the title shown isn't the name a screen reader should hear
  label?: string;
  className?: string;
  onExitComplete?: () => void;
  children: ReactNode;
};

function focusedElement() {
  if (typeof document === "undefined") return null;
  return document.activeElement instanceof HTMLElement ? document.activeElement : null;
}

// Radix locks the page behind (iOS Safari included), keeps focus inside, closes on Escape
// and gives focus back to whatever had it before
export function Modal({
  open,
  onClose,
  variant = "dialog",
  layer = "base",
  label,
  className,
  onExitComplete,
  children,
}: ModalProps) {
  const panel = MODAL_PANELS[variant];
  const z = MODAL_LAYERS[layer];
  // Radix only gives focus back to its own Trigger, and these open from our buttons
  const [returnTo, setReturnTo] = useState(() => (open ? focusedElement() : null));
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setReturnTo(focusedElement());
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <AnimatePresence onExitComplete={onExitComplete}>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: variant === "page" ? 0 : 0.45 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className={cn("fixed inset-0 bg-black", z.overlay)}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={undefined}
              onEscapeKeyDown={(e) => {
                // Escape closes an open picker or suggestion list first, not the whole modal
                if (
                  document.querySelector(`${MODAL_PANEL_SELECTOR} ${POPOVER_SELECTOR}`) ||
                  document.activeElement?.closest(HANDLES_ESCAPE_SELECTOR)
                )
                  e.preventDefault();
              }}
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                if (returnTo?.isConnected) returnTo.focus();
              }}
              {...(label ? { "aria-labelledby": undefined, "aria-label": label } : {})}
            >
              <motion.div
                initial={panel.initial}
                animate={panel.animate}
                exit={panel.initial}
                transition={panel.transition}
                data-modal-panel
                // the drawer's holder covers the screen, so a tap on its empty part is a tap outside
                onClick={
                  variant === "drawer"
                    ? (e) => e.target === e.currentTarget && onClose()
                    : undefined
                }
                className={cn(panel.className, z.panel, className)}
              >
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

type ModalTitleProps = { className?: string; children: ReactNode };

export function ModalTitle({ className, children }: ModalTitleProps) {
  return (
    <Dialog.Title className={cn("font-pixel min-w-0 truncate text-xs", className)}>
      {children}
    </Dialog.Title>
  );
}

type ModalHeaderProps = { title: ReactNode; onClose: () => void };

export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  return (
    <div className="bg-foreground text-background flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
      <ModalTitle>{title}</ModalTitle>
      <BracketButton type="button" variant="inverted" onClick={onClose}>
        x
      </BracketButton>
    </div>
  );
}
