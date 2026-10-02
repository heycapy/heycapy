import { useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { dismissDeliveryFailuresAction } from "@/app/(app)/actions";
import type { ChannelFailure } from "@/lib/notifications/failures";
import { channelKey } from "@/lib/notifications/channel-key";
import { DeliveryFailuresDialog } from "./DeliveryFailuresDialog";

type DeliveryFailureBannerProps = {
  failures: ChannelFailure[];
  onFix: () => void;
};

export function DeliveryFailureBanner({ failures, onFix }: DeliveryFailureBannerProps) {
  const [details, setDetails] = useState<ChannelFailure | null>(null);
  const [dismissing, setDismissing] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  function dismiss(failure: ChannelFailure) {
    const key = channelKey(failure);
    setDismissing((prev) => [...prev, key]);
    startTransition(async () => {
      try {
        await dismissDeliveryFailuresAction(failure.medium, failure.webhookId);
      } finally {
        setDismissing((prev) => prev.filter((k) => k !== key));
      }
    });
  }

  const visible = failures.filter((f) => !dismissing.includes(channelKey(f)));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-4 pt-3">
      {visible.map((failure) => {
        const count = failure.deliveries.length;
        const latestError = failure.deliveries[0]?.error;
        return (
          <div
            key={channelKey(failure)}
            role="alert"
            className="border-border text-destructive flex items-center gap-3 border border-dashed px-3 py-2 font-mono text-xs"
          >
            <span className="min-w-0 flex-1 truncate">
              ⚠ {failure.label}: {count} {count === 1 ? "notification" : "notifications"} failed
              {latestError && ` · ${latestError}`}
            </span>
            <BracketButton onClick={onFix} className="shrink-0">
              fix
            </BracketButton>
            <BracketButton onClick={() => setDetails(failure)} className="shrink-0">
              details
            </BracketButton>
            <BracketButton
              onClick={() => dismiss(failure)}
              aria-label={`dismiss ${failure.label} failures`}
              className="shrink-0"
            >
              x
            </BracketButton>
          </div>
        );
      })}
      {details && <DeliveryFailuresDialog failure={details} onClose={() => setDetails(null)} />}
    </div>
  );
}
