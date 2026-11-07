import type { ReactNode } from "react";
import { BottomDrawer } from "@/components/ui/Drawer";

type CapyChatDrawerProps = {
  open: boolean;
  header: ReactNode;
  children: ReactNode;
  onClose: () => void;
};

export function CapyChatDrawer({ open, header, children, onClose }: CapyChatDrawerProps) {
  return (
    <BottomDrawer
      open={open}
      onClose={onClose}
      label="chat with capy"
      header={header}
      className="h-[85%]"
    >
      <div className="flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]">
        {children}
      </div>
    </BottomDrawer>
  );
}
