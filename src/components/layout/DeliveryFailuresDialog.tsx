import { Modal, ModalHeader } from "@/components/ui/Modal";
import { formatShort } from "@/lib/format-date";
import type { ChannelFailure } from "@/lib/notifications/failures";

type DeliveryFailuresDialogProps = {
  failure: ChannelFailure;
  onClose: () => void;
};

export function DeliveryFailuresDialog({ failure, onClose }: DeliveryFailuresDialogProps) {
  return (
    <Modal open onClose={onClose} className="top-[12%] sm:top-[12%]">
      <div className="border-border bg-background flex max-h-[70vh] flex-col border-2">
        <ModalHeader title={`failed [${failure.label}]`} onClose={onClose} />
        <ul className="divide-border/50 flex flex-col divide-y divide-dotted overflow-y-auto overscroll-contain px-4 py-2">
          {failure.deliveries.map((delivery, i) => (
            <li key={i} className="flex flex-col gap-0.5 py-2 font-mono text-xs">
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
    </Modal>
  );
}
