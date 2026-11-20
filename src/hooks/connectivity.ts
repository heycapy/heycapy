import { useEffect } from "react";
import { useUIStore } from "@/store/ui";

// Actions return `{ ok: false }` for expected errors, so a call that throws never reached the server
export async function reach<T>(call: Promise<T>): Promise<T | null> {
  try {
    const result = await call;
    useUIStore.getState().setOffline(false);
    return result;
  } catch {
    useUIStore.getState().setOffline(true);
    return null;
  }
}

export function useConnectivity() {
  const setOffline = useUIStore((s) => s.setOffline);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    if (!navigator.onLine) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [setOffline]);
}
