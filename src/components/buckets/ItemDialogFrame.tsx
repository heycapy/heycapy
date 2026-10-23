import type { ReactNode, RefObject } from "react";
import { Modal, ModalHeader } from "@/components/ui/Modal";
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
    <Modal
      open={open}
      onClose={onCancel}
      className={cn("top-[5%] sm:top-[5%]", wide ? "max-w-md" : "max-w-sm")}
    >
      <div className="border-border bg-background flex max-h-[78vh] flex-col overflow-hidden border-2">
        <ModalHeader title={heading} onClose={onCancel} />
        <div
          ref={scrollBodyRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4"
        >
          {children}
        </div>
        <div className="border-border flex shrink-0 items-center justify-between border-t px-3 py-2.5">
          {footer}
        </div>
      </div>
    </Modal>
  );
}
