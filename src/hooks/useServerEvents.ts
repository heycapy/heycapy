"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui";

export function useServerEvents() {
  const router = useRouter();
  const tickAiRefresh = useUIStore((s) => s.tickAiRefresh);

  useEffect(() => {
    let reconnecting = false;
    const source = new EventSource("/api/events");

    source.onopen = () => {
      if (reconnecting) {
        router.refresh();
        tickAiRefresh();
      }
      reconnecting = true;
    };

    source.onmessage = (e) => {
      if (e.data === "refresh") {
        router.refresh();
        tickAiRefresh();
      }
    };

    return () => source.close();
  }, [router, tickAiRefresh]);
}
