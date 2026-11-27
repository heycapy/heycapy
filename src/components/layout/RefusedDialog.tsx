import { Modal, ModalTitle } from "@/components/ui/Modal";
import { TextButton } from "@/components/ui/TextButton";
import type { StoredRejection } from "@/lib/sync/client/types";
import { rejectionMessage } from "@/lib/sync/client/rejections";

type RefusedDialogProps = {
  refused: StoredRejection[];
  onDismiss: (ids: number[]) => void;
  onClose: () => void;
};

export function RefusedDialog({ refused, onDismiss, onClose }: RefusedDialogProps) {
  return (
    <Modal
      open
      onClose={onClose}
      className="shadow-raised top-1/2 w-auto max-w-[calc(100%-2rem)] min-w-[260px] -translate-y-1/2 sm:top-1/2"
    >
      <div className="bg-background border-border rounded-panel border-frame p-5">
        <ModalTitle className="mb-1 text-sm">changes that weren&apos;t saved</ModalTitle>
        <p className="text-muted-foreground font-ui mb-3 text-xs">
          the server refused these, so they were undone.
        </p>
        <ul className="font-ui mb-4 flex max-h-64 flex-col gap-2 overflow-y-auto text-xs">
          {refused.map((r) => (
            <li key={r.id} className="flex items-start gap-3">
              <span className="min-w-0 flex-1 break-words">{rejectionMessage(r)}</span>
              <TextButton onClick={() => onDismiss([r.id])} className="shrink-0 px-2 py-1">
                dismiss
              </TextButton>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <TextButton
            onClick={() => {
              onDismiss(refused.map((r) => r.id));
              onClose();
            }}
            className="px-2 py-1"
          >
            dismiss all
          </TextButton>
          <TextButton onClick={onClose} className="px-2 py-1">
            close
          </TextButton>
        </div>
      </div>
    </Modal>
  );
}
