import { useEffect, useEffectEvent, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { HANDLES_ESCAPE_SELECTOR, POPOVER_SELECTOR } from "@/components/ui/constants";
import { ADD_PANEL_DIM, ADD_PANEL_MOTION } from "./constants";

// Where the add box opens into a form, and what to do once it folds back
export type AddPanel = {
  slot: HTMLElement;
  bucketName: string;
  onCollapsed: () => void;
};

type ItemPanelFrameProps = {
  open: boolean;
  heading: string;
  panel: AddPanel;
  scrollBodyRef: RefObject<HTMLDivElement | null>;
  title: ReactNode;
  confirm: ReactNode;
  children: ReactNode;
  onCancel: () => void;
};

// The add box grows up into the form: not modal, the list stays usable and a click on it folds
// the form away, keeping the draft
export function ItemPanelFrame({
  open,
  heading,
  panel,
  scrollBodyRef,
  title,
  confirm,
  children,
  onCancel,
}: ItemPanelFrameProps) {
  const headingId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);
  const cancel = useEffectEvent(onCancel);
  const collapsed = useEffectEvent(panel.onCollapsed);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element;
      if (panelRef.current?.contains(target) || target.closest(POPOVER_SELECTOR)) return;
      cancel();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // Escape closes an open picker or suggestion list first
      if (
        document.querySelector(POPOVER_SELECTOR) ||
        document.activeElement?.closest(HANDLES_ESCAPE_SELECTOR)
      )
        return;
      cancel();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const closing = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closing) return;
    const active = document.activeElement;
    // a click on something else outside keeps its focus
    if (!active || active === document.body || panelRef.current?.contains(active)) collapsed();
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="dim"
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: ADD_PANEL_DIM }}
            exit={{ opacity: 0 }}
            transition={ADD_PANEL_MOTION.transition}
            className="pointer-events-none fixed inset-0 bg-black"
          />
          <motion.div
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-labelledby={headingId}
            data-add-panel
            initial={ADD_PANEL_MOTION.initial}
            animate={ADD_PANEL_MOTION.animate}
            exit={ADD_PANEL_MOTION.initial}
            transition={ADD_PANEL_MOTION.transition}
            className="bg-background border-border absolute inset-x-0 bottom-0 flex max-h-[70vh] flex-col border-x-2"
          >
            <div className="bg-foreground text-background flex shrink-0 items-center gap-2 px-3 py-1.5">
              <h2 id={headingId} className="font-pixel shrink-0 text-xs">
                {heading}
              </h2>
              <span className="min-w-0 flex-1 truncate font-mono text-xs opacity-60">
                in {panel.bucketName}
              </span>
              <BracketButton type="button" variant="inverted" onClick={onCancel}>
                x
              </BracketButton>
            </div>
            <div
              ref={scrollBodyRef}
              className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4"
            >
              {children}
            </div>
            {/* exactly the footer's row: its line lies over the footer's, the title where the add box's text was */}
            <div className="bg-card flex min-h-12 shrink-0 items-start gap-1 border-t-2 border-(--accent) pr-1 pl-2">
              <div className="min-w-0 flex-1">{title}</div>
              {confirm}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    panel.slot
  );
}
