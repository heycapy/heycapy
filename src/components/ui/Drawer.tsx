"use client";

import type { PointerEvent, ReactNode } from "react";
import { motion, useDragControls, type PanInfo } from "framer-motion";
import { SHEET_CLOSE_DRAG_PX, SHEET_CLOSE_DRAG_VELOCITY } from "@/constants";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { cn } from "@/lib/utils";
import { Modal } from "./Modal";
import { DRAWER_MOTION } from "./constants";

export function useDrawerDrag(onClose: () => void, enabled = true) {
  const controls = useDragControls();
  function startDrag(e: PointerEvent) {
    if (enabled && !(e.target as HTMLElement).closest("button, input, textarea")) {
      controls.start(e);
    }
  }
  const dragProps = enabled
    ? {
        drag: "y" as const,
        dragListener: false,
        dragControls: controls,
        dragConstraints: { top: 0, bottom: 0 },
        dragElastic: { top: 0, bottom: 1 },
        onDragEnd: (_: unknown, info: PanInfo) => {
          if (info.offset.y > SHEET_CLOSE_DRAG_PX || info.velocity.y > SHEET_CLOSE_DRAG_VELOCITY)
            onClose();
        },
      }
    : {};
  return { startDrag, dragProps };
}

export function DrawerHandle({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex justify-center pt-2 pb-1", className)}>
      <div className="h-1 w-10 rounded-full bg-current opacity-30" />
    </div>
  );
}

type BottomDrawerProps = {
  open: boolean;
  onClose: () => void;
  label: string;
  header: ReactNode;
  className?: string;
  children: ReactNode;
};

export function BottomDrawer({
  open,
  onClose,
  label,
  header,
  className,
  children,
}: BottomDrawerProps) {
  return (
    <Modal open={open} onClose={onClose} variant="drawer" label={label}>
      <DrawerPanel onClose={onClose} header={header} className={className}>
        {children}
      </DrawerPanel>
    </Modal>
  );
}

function DrawerPanel({
  onClose,
  header,
  className,
  children,
}: Omit<BottomDrawerProps, "open" | "label">) {
  const visible = useVisualViewport();
  const { startDrag, dragProps } = useDrawerDrag(onClose);
  return (
    <div
      style={visible ? { top: visible.top, height: visible.height } : undefined}
      className="pointer-events-none absolute inset-x-0 top-0 bottom-0 flex flex-col justify-end px-(--drawer-inset) pb-(--drawer-inset)"
    >
      <motion.div
        initial={DRAWER_MOTION.initial}
        animate={DRAWER_MOTION.animate}
        exit={DRAWER_MOTION.exit}
        {...dragProps}
        className={cn(
          "border-border bg-background drawer-frame pointer-events-auto relative mx-auto flex w-full flex-col overflow-hidden",
          className
        )}
      >
        <div onPointerDown={startDrag} className="bg-card shrink-0 touch-none select-none">
          <DrawerHandle className="text-muted-foreground md:hidden" />
          {header}
        </div>
        {children}
      </motion.div>
    </div>
  );
}
