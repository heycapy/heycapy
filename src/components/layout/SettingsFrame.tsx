import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SidePanel } from "@/components/ui/SidePanel";
import { ACCENT_BUTTONS } from "./settings-constants";

type SettingsFrameProps = {
  open: boolean;
  onRequestClose: () => void;
  children: ReactNode;
};

export function SettingsFrame({ open, onRequestClose, children }: SettingsFrameProps) {
  return (
    <SidePanel
      open={open}
      onClose={onRequestClose}
      title="tweaks"
      narrow="sheet"
      className={cn(ACCENT_BUTTONS)}
    >
      {children}
    </SidePanel>
  );
}
