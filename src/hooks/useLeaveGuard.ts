import { useEffect } from "react";
import { useLayoutStore } from "@/store/layout";

export function useLeaveGuard(open: boolean, unsaved: boolean, onBlocked: () => void) {
  const setLeaveGuard = useLayoutStore((s) => s.setLeaveGuard);
  useEffect(() => {
    if (!open) return;
    setLeaveGuard(() => {
      if (!unsaved) return true;
      onBlocked();
      return false;
    });
    return () => setLeaveGuard(null);
  }, [open, unsaved, onBlocked, setLeaveGuard]);
}
