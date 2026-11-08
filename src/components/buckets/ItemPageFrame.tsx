import type { ReactNode, RefObject } from "react";
import { TextButton } from "@/components/ui/TextButton";
import { Modal, ModalTitle } from "@/components/ui/Modal";

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
  return (
    <Modal open={open} onClose={onCancel} variant="page">
      <div className="border-border border-b-frame flex shrink-0 items-center justify-center px-2 pt-[env(safe-area-inset-top)]">
        <ModalTitle className="py-3.5">{heading}</ModalTitle>
      </div>
      <div
        ref={scrollBodyRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 py-4"
      >
        {children}
        {secondary}
      </div>
      <div className="border-border border-t-frame flex shrink-0 items-center justify-between px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <TextButton onClick={onCancel} className="px-2 py-3 text-base">
          cancel
        </TextButton>
        {confirm}
      </div>
    </Modal>
  );
}
