import { useEffect, useState } from "react";
import { getAIStatusAction } from "@/app/(app)/actions";
import { useUIStore } from "@/store/ui";
import type { AIStatus } from "@/lib/ai/status";

export function useAIStatus(): AIStatus | null {
  const tick = useUIStore((s) => s.aiRefreshTick);
  const [status, setStatus] = useState<AIStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAIStatusAction().then((result) => {
      if (!cancelled && result.ok) setStatus(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return status;
}
