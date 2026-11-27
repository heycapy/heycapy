import { useState, type ReactNode } from "react";

export function OnceOpen({ open, children }: { open: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened ? children : null;
}
