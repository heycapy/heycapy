import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { ACCENT_BUTTONS } from "./settings-constants";

type SettingsFrameProps = {
  open: boolean;
  onRequestClose: () => void;
  children: ReactNode;
};

export function SettingsFrame({ open, onRequestClose, children }: SettingsFrameProps) {
  return (
    <Modal open={open} onClose={onRequestClose} variant="sheet" className={cn(ACCENT_BUTTONS)}>
      <ModalHeader title="tweaks" onClose={onRequestClose} />
      {children}
    </Modal>
  );
}
