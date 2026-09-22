"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useServerEvents() {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.onmessage = (e) => {
      if (e.data === "refresh") router.refresh();
    };

    source.onerror = () => {
      // EventSource auto-reconnects on error — nothing to do
    };

    return () => source.close();
  }, [router]);
}
