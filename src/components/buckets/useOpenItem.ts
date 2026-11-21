import type { ItemId } from "@/types/ids";
import { useEffect, useRef, useState } from "react";
import type { OpenFocus } from "./constants";

// Which row is open for editing and where the cursor starts, and giving the focus back to its title
// once it closes by keyboard
export function useOpenItem() {
  const [opened, setOpened] = useState<{ id: ItemId; focus: OpenFocus } | null>(null);
  const refocusId = useRef<ItemId | null>(null);

  useEffect(() => {
    if (opened !== null || refocusId.current === null) return;
    const id = refocusId.current;
    refocusId.current = null;
    // Focus that moved on to something else while the row folded away stays there
    if (document.activeElement && document.activeElement !== document.body) return;
    document.querySelector<HTMLElement>(`#item-${id} [data-item-title]`)?.focus();
  }, [opened]);

  return {
    openId: opened?.id ?? null,
    focus: opened?.focus ?? "title",
    open(id: ItemId, focus: OpenFocus) {
      setOpened({ id, focus });
    },
    close(itemId: ItemId, focusRow: boolean) {
      refocusId.current = focusRow ? itemId : null;
      setOpened(null);
    },
  };
}
