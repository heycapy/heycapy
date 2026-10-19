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
    const ours = process.env.NEXT_DEPLOYMENT_ID;
    let source: EventSource | null = null;
    let reconnecting = false;
    let catchUp = false;
    let outdated = false;

    function refresh() {
      if (outdated) return;
      router.refresh();
      tickAiRefresh();
    }

    function connect() {
      source?.close();
      source = new EventSource("/api/events");
      source.onopen = () => {
        catchUp = reconnecting;
        reconnecting = true;
        if (catchUp && !ours) {
          catchUp = false;
          refresh();
        }
      };
      source.onmessage = (e) => {
        if (e.data === "refresh") refresh();
      };
      source.addEventListener(SERVER_VERSION_EVENT, (e) => {
        if (ours && e.data !== ours) {
          outdated = true;
          setNewVersion(true);
        }
        if (catchUp) {
          catchUp = false;
          refresh();
        }
      });
    }

    // Phones drop the connection while the app is in the background and don't always reconnect it
    function resume() {
      if (document.visibilityState !== "visible") return;
      reconnecting = true;
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
