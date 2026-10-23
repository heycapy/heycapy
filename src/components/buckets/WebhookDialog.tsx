import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { WebhookPanel } from "./WebhookPanel";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

type WebhookDialogProps = {
  open: boolean;
  bucket: BucketRow;
  onClose: () => void;
};

export function WebhookDialog({ open, bucket, onClose }: WebhookDialogProps) {
  return (
    <Modal open={open} onClose={onClose} layer="raised">
      <div
        className={cn(
          "border-border bg-background flex max-h-[85vh] flex-col overflow-hidden border-2",
          ACCENT_BUTTONS
        )}
      >
        <ModalHeader title={`webhook [${bucket.name}]`} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <WebhookPanel bucket={bucket} />
        </div>
      </div>
    </Modal>
  );
}
