import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { firstMissingRequired, type InlineDraft } from "@/lib/items/edit-draft";
import { smoothScroll } from "@/lib/motion";
import type { FieldDef } from "@/types/rules";
import { useOutsideTap } from "./useOutsideTap";

type EditorExitOptions = {
  rootRef: RefObject<HTMLDivElement | null>;
  draftRef: RefObject<InlineDraft>;
  fields: FieldDef[];
  canSave?: () => boolean;
  onSave: () => void;
  saveOnOutsideTap: boolean;
  onExit: (focusRow: boolean) => void;
};

export function useEditorExit({
  rootRef,
  draftRef,
  fields,
  canSave,
  onSave,
  saveOnOutsideTap,
  onExit,
}: EditorExitOptions) {
  const [closing, setClosing] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const closedRef = useRef(false);
  const refocusRef = useRef(false);

  function finish(save: boolean, refocus: boolean) {
    if (closedRef.current) return;
    if (save) {
      if (canSave && !canSave()) return;
      const missing = firstMissingRequired(fields, draftRef.current.properties);
      if (missing) {
        setAttempted(true);
        requestAnimationFrame(() =>
          rootRef.current
            ?.querySelector(`[data-field-key="${missing.key}"]`)
            ?.scrollIntoView({ block: "nearest", behavior: smoothScroll() })
        );
        return;
      }
      onSave();
    }
    closedRef.current = true;
    refocusRef.current = refocus;
    setClosing(true);
  }

  useOutsideTap(rootRef, () => finish(saveOnOutsideTap, false), !closing);

  // A button that goes away when pressed (a reminder's ×) takes the focus with it, and Escape and
  // Ctrl+Enter only reach the row from inside it
  function keepFocus() {
    if (closedRef.current || document.activeElement !== document.body) return;
    rootRef.current?.focus({ preventScroll: true });
  }

  useLayoutEffect(keepFocus);

  function onKeyDown(e: KeyboardEvent) {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      finish(false, true);
    } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      finish(true, true);
    }
  }

  return {
    closing,
    attempted,
    closedRef,
    finish,
    keepFocus,
    onKeyDown,
    folded: () => onExit(refocusRef.current),
  };
}
