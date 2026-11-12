"use client";

import { IconButton } from "@/components/ui/IconButton";
import { useUIStore } from "@/store/ui";

export function FocusExit() {
  const setFocusMode = useUIStore((s) => s.setFocusMode);
  return (
    <IconButton
      icon="collapse"
      aria-label="exit focus mode"
      onClick={() => setFocusMode(false)}
      className="hover:bg-muted fixed top-3 right-3 z-20 p-2 opacity-60 hover:opacity-100"
    />
  );
}
