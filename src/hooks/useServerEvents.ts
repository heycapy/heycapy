import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui";
import { SERVER_VERSION_EVENT } from "@/constants";

// Returns whether the server now runs a newer build than this page
export function useServerEvents(): boolean {
  const router = useRouter();
  const tickAiRefresh = useUIStore((s) => s.tickAiRefresh);
  const [newVersion, setNewVersion] = useState(false);

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
      source.addEventListener(SERVER_VERSION_EVENT, (e) => {
        const ours = process.env.NEXT_DEPLOYMENT_ID;
        if (ours && e.data !== ours) setNewVersion(true);
      });
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

  return newVersion;
}
