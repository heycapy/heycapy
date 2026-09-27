"use client";

import { useState } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import type { ChannelFailure } from "@/lib/notifications/failures";
import { DeliveryFailuresDialog } from "./DeliveryFailuresDialog";

interface DeliveryFailureBannerProps {
  failures: ChannelFailure[];
  onFix: () => void;
}

export function DeliveryFailureBanner({ failures, onFix }: DeliveryFailureBannerProps) {
  const [details, setDetails] = useState<ChannelFailure | null>(null);

  if (failures.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      {failures.map((failure) => {
        const count = failure.deliveries.length;
        const latestError = failure.deliveries[0]?.error;
        return (
          <div
            key={failure.medium}
            role="alert"
            className="border-border text-destructive flex items-center gap-3 border border-dashed px-3 py-2 font-mono text-[10px]"
          >
            <span className="min-w-0 flex-1 truncate">
              ⚠ {failure.medium}: {count} {count === 1 ? "notification" : "notifications"} failed
              {latestError && ` · ${latestError}`}
            </span>
            <BracketButton onClick={onFix} className="shrink-0">
              fix
            </BracketButton>
            <BracketButton onClick={() => setDetails(failure)} className="shrink-0">
              details
            </BracketButton>
          </div>
        );
      })}
      {details && <DeliveryFailuresDialog failure={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
