import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { formatShort } from "@/lib/format-date";
import { useScrollLock } from "@/hooks/useScrollLock";
import type { ChannelFailure } from "@/lib/notifications/failures";

type DeliveryFailuresDialogProps = {
  failure: ChannelFailure;
  onClose: () => void;
};

export function DeliveryFailuresDialog({ failure, onClose }: DeliveryFailuresDialogProps) {
  useScrollLock(true);

  return createPortal(
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.45 }}
        transition={{ duration: 0.12 }}
        className="fixed inset-0 z-[55] bg-black"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="fixed top-[12%] left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
        style={{ boxShadow: "5px 5px 0 var(--border)" }}
      >
        <div className="border-border bg-background flex max-h-[70vh] flex-col border-2">
          <div className="bg-foreground text-background flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="font-pixel min-w-0 truncate text-xs">failed [{failure.medium}]</span>
            <BracketButton variant="inverted" onClick={onClose}>
              x
            </BracketButton>
          </div>
          <ul className="divide-border/50 flex flex-col divide-y divide-dotted overflow-y-auto px-4 py-2">
            {failure.deliveries.map((delivery, i) => (
              <li key={i} className="flex flex-col gap-0.5 py-2 font-mono text-[10px]">
                <span className="text-foreground truncate">{delivery.title}</span>
                <span className="text-muted-foreground">
                  {delivery.bucketName && `${delivery.bucketName} · `}
                  {formatShort(delivery.at)}
                </span>
                {delivery.error && (
                  <span className="text-destructive break-words">{delivery.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </>,
    document.body
  );
}
