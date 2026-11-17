import { useEffect, useRef, useState } from "react";
import type { OpenFocus } from "./constants";

// Which row is open for editing and where the cursor starts, and giving the focus back to its title
// once it closes by keyboard
export function useOpenItem() {
  const [opened, setOpened] = useState<{ id: number; focus: OpenFocus } | null>(null);
  const refocusId = useRef<number | null>(null);

  useEffect(() => {
    if (opened !== null || refocusId.current === null) return;
    document.querySelector<HTMLElement>(`#item-${refocusId.current} [data-item-title]`)?.focus();
    refocusId.current = null;
  }, [opened]);

  return {
    openId: opened?.id ?? null,
    focus: opened?.focus ?? "title",
    open(id: number, focus: OpenFocus) {
      setOpened({ id, focus });
    },
    close(itemId: number, focusRow: boolean) {
      refocusId.current = focusRow ? itemId : null;
      setOpened(null);
    },
  };
}
