import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { CloseButton } from "@/components/ui/CloseButton";
import { useLookParts } from "@/components/looks/LookProvider";
import {
  HANDLES_ESCAPE_SELECTOR,
  MODAL_PANEL_SELECTOR,
  POPOVER_SELECTOR,
} from "@/components/ui/constants";
import {
  ADD_PANEL_DIM,
  ADD_PANEL_DIM_FADE,
  ADD_PANEL_MOTION,
  ITEM_PANEL_RESIZE,
  EDIT_ROW_GAP_PX,
  OUTSIDE_TAP_CLICK_MS,
  PHONE_DRAWER_TOP_GAP_PX,
} from "./constants";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { SHEET_CLOSE_DRAG_PX, SHEET_CLOSE_DRAG_VELOCITY } from "@/constants";
import { cn } from "@/lib/utils";

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
  secondary?: ReactNode;
  returnToOpener: boolean;
  phone: boolean;
  children: ReactNode;
  onCancel: () => void;
};

export function ItemPanelFrame({
  open,
  heading,
  panel,
  scrollBodyRef,
  title,
  confirm,
  secondary,
  returnToOpener,
  phone,
  children,
  onCancel,
}: ItemPanelFrameProps) {
  const headingId = useId();
  const { panelHeader, footer } = useLookParts();
  const inverted = panelHeader === "inverted";
  const floating = footer === "floating";
  const dragControls = useDragControls();
  const visible = useVisualViewport();
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!phone || !open || !el) return;
    const top = panel.slot.closest("main")?.getBoundingClientRect().top ?? 0;
    const room = panel.slot.getBoundingClientRect().bottom - top - PHONE_DRAWER_TOP_GAP_PX;
    el.style.maxHeight = `${room}px`;
  }, [phone, open, visible, panel.slot]);
  useEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    const root = document.documentElement.style;
    const observer = new ResizeObserver(() => {
      const footer = panel.slot.parentElement?.offsetHeight ?? 0;
      root.setProperty("--item-panel-cover", `${Math.max(0, el.offsetHeight - footer)}px`);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty("--item-panel-cover");
    };
  }, [open, panel.slot]);
  useEffect(() => {
    const main = panel.slot.closest("main");
    if (!open || !main) return;
    const scrollbar = main.offsetWidth - main.clientWidth;
    main.style.overflowY = "hidden";
    main.style.paddingRight = `${scrollbar}px`;
    return () => {
      main.style.overflowY = "";
      main.style.paddingRight = "";
    };
  }, [open, panel.slot]);

  useEffect(() => {
    const el = panelRef.current;
    if (!open || !returnToOpener || !el) return;
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector<HTMLElement>("[data-editing]");
      if (!row) return;
      const panelTop = panel.slot.getBoundingClientRect().bottom - el.offsetHeight;
      const hidden = row.getBoundingClientRect().bottom - panelTop + EDIT_ROW_GAP_PX;
      if (hidden > 0) row.closest("main")?.scrollBy({ top: hidden, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, returnToOpener, panel.slot]);
  const wasOpen = useRef(open);
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  const [shownOpen, setShownOpen] = useState(open);
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [opening, setOpening] = useState(0);
  if (open !== shownOpen) {
    setShownOpen(open);
    setContentHeight(null);
    if (open) setOpening((n) => n + 1);
    if (open)
      setOpener(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  }
  const measureContent = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const observer = new ResizeObserver(() => setContentHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const cancel = useEffectEvent(onCancel);
  const collapsed = useEffectEvent(panel.onCollapsed);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element;
      if (panelRef.current?.contains(target) || target.closest(POPOVER_SELECTOR)) return;
      cancel();
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      const stop = () => document.removeEventListener("click", swallow, true);
      document.addEventListener("click", swallow, { capture: true, once: true });
      document.addEventListener("pointerdown", stop, { capture: true, once: true });
      setTimeout(stop, OUTSIDE_TAP_CLICK_MS);
    }
    function modalOverPanel() {
      const modal = document.activeElement?.closest(MODAL_PANEL_SELECTOR);
      return !!modal && !modal.contains(panelRef.current);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (
        document.querySelector(POPOVER_SELECTOR) ||
        document.activeElement?.closest(HANDLES_ESCAPE_SELECTOR) ||
        modalOverPanel()
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
    if (active && active !== document.body && !panelRef.current?.contains(active)) return;
    if (returnToOpener && opener?.isConnected) opener.focus();
    else collapsed();
  }, [open, returnToOpener, opener]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key={`dim-${opening}`}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: ADD_PANEL_DIM }}
            exit={{ opacity: 0 }}
            transition={ADD_PANEL_DIM_FADE}
            className="pointer-events-none fixed inset-0 bg-black"
          />
          <motion.div
            key={`panel-${opening}`}
            ref={panelRef}
            role="dialog"
            aria-labelledby={headingId}
            data-item-panel
            initial={ADD_PANEL_MOTION.initial}
            animate={ADD_PANEL_MOTION.animate}
            exit={ADD_PANEL_MOTION.exit}
            drag={phone ? "y" : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={(_, info: PanInfo) => {
              if (
                info.offset.y > SHEET_CLOSE_DRAG_PX ||
                info.velocity.y > SHEET_CLOSE_DRAG_VELOCITY
              )
                onCancel();
            }}
            className={cn(
              "bg-background border-border rounded-t-panel absolute inset-x-0 bottom-0 flex flex-col",
              !phone && "border-x-frame max-h-[70vh]",
              floating && "rounded-panel border-frame shadow-raised-lg overflow-hidden"
            )}
          >
            <div
              onPointerDown={phone ? (e) => dragControls.start(e) : undefined}
              className={cn(
                "rounded-t-panel shrink-0 px-4 py-2.5",
                inverted && "bg-foreground text-background",
                phone && "touch-none pt-1 select-none"
              )}
            >
              {phone && (
                <div aria-hidden className="flex justify-center pb-1">
                  <div
                    className={cn(
                      "h-1 w-10 rounded-full",
                      inverted ? "bg-background/50" : "bg-muted-foreground/40"
                    )}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <h2 id={headingId} className="font-display shrink-0 text-sm">
                  {heading}
                </h2>
                <span className="font-ui min-w-0 flex-1 truncate text-xs opacity-60">
                  {panel.bucketName && `in ${panel.bucketName}`}
                </span>
                <CloseButton
                  type="button"
                  variant={inverted ? "inverted" : "default"}
                  onClick={onCancel}
                  aria-label={phone ? `close ${heading}` : undefined}
                  className={cn(phone && "sr-only")}
                />
              </div>
            </div>
            <motion.div
              ref={scrollBodyRef}
              initial={false}
              animate={{ height: contentHeight ?? "auto" }}
              transition={ITEM_PANEL_RESIZE}
              className="min-h-0 shrink overflow-x-hidden overflow-y-auto overscroll-contain"
            >
              <div ref={measureContent} className="px-5 py-4">
                {children}
                {secondary}
              </div>
            </motion.div>
            <div className="bg-card border-t-frame flex min-h-12 shrink-0 items-start gap-1 border-(--accent) pr-1 pl-2">
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
