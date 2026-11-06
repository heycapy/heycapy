import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { HANDLES_ESCAPE_SELECTOR, POPOVER_SELECTOR } from "@/components/ui/constants";
import { ADD_PANEL_DIM, ADD_PANEL_MOTION } from "./constants";

// Where the footer opens into the item form, and where focus goes once a new item's form folds back
export type ItemPanel = {
  slot: HTMLElement;
  bucketName?: string;
  onCollapsed: () => void;
};

type ItemPanelFrameProps = {
  open: boolean;
  heading: string;
  panel: ItemPanel;
  scrollBodyRef: RefObject<HTMLDivElement | null>;
  title: ReactNode;
  confirm: ReactNode;
  // under the details, like delete when editing
  secondary?: ReactNode;
  // a new item's form hands focus to the add box; an edit gives it back to the row it came from
  returnToOpener: boolean;
  children: ReactNode;
  onCancel: () => void;
};

// The footer grows up into the form: not modal, the list stays usable and a click on it folds the
// form away (a new item keeps its draft, an edit is dropped like a cancel)
export function ItemPanelFrame({
  open,
  heading,
  panel,
  scrollBodyRef,
  title,
  confirm,
  secondary,
  returnToOpener,
  children,
  onCancel,
}: ItemPanelFrameProps) {
  const headingId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(open);
  // read while rendering open: by the time effects run the title has already taken focus
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [shownOpen, setShownOpen] = useState(open);
  if (open !== shownOpen) {
    setShownOpen(open);
    if (open)
      setOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }
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
    if (active && active !== document.body && !panelRef.current?.contains(active)) return;
    if (returnToOpener && opener?.isConnected) opener.focus();
    else collapsed();
  }, [open, returnToOpener, opener]);

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
            data-item-panel
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
                {panel.bucketName && `in ${panel.bucketName}`}
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
              {secondary}
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
