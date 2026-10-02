import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui";

export function useServerEvents() {
  const router = useRouter();
  const tickAiRefresh = useUIStore((s) => s.tickAiRefresh);

  useEffect(() => {
    let source: EventSource | null = null;
    let reconnecting = false;

    function refresh() {
      router.refresh();
      tickAiRefresh();
    }

    function connect() {
      source?.close();
      source = new EventSource("/api/events");
      source.onopen = () => {
        if (reconnecting) refresh();
        reconnecting = true;
      };
      source.onmessage = (e) => {
        if (e.data === "refresh") refresh();
      };
    }

    // Phones drop the connection while the app is in the background and don't always reconnect it
    function resume() {
      if (document.visibilityState !== "visible") return;
      refresh();
      reconnecting = false;
      connect();
    }

    connect();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      source?.close();
    };
  }, [router, tickAiRefresh]);
}
