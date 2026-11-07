import type { ReactNode } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SIDE_DOCK_MEDIA_QUERY } from "@/constants";
import { cn } from "@/lib/utils";
import { Modal, ModalHeader } from "./Modal";

type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  context?: string;
  narrow: "sheet" | "dialog";
  className?: string;
  children: ReactNode;
};

export function SidePanel({
  open,
  onClose,
  title,
  context,
  narrow,
  className,
  children,
}: SidePanelProps) {
  const docked = useMediaQuery(SIDE_DOCK_MEDIA_QUERY);
  const content = (
    <>
      <ModalHeader title={title} context={context} onClose={onClose} plain={docked} />
      {children}
    </>
  );

  if (!docked && narrow === "dialog") {
    return (
      <Modal open={open} onClose={onClose}>
        <div
          className={cn(
            "border-border bg-background rounded-panel border-frame flex max-h-[75dvh] flex-col overflow-hidden",
            className
          )}
        >
          {content}
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} variant={docked ? "side" : narrow} className={className}>
      {content}
    </Modal>
  );
}
