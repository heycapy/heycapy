import { Modal, ModalHeader } from "@/components/ui/Modal";
import { ItemReminderInfo } from "./ItemReminderInfo";

type ReminderInfoDialogProps = {
  itemId: number;
  title: string;
  onClose: () => void;
};

export function ReminderInfoDialog({ itemId, title, onClose }: ReminderInfoDialogProps) {
  return (
    <Modal open onClose={onClose} className="top-[12%] sm:top-[12%]">
      <div className="border-border bg-background flex max-h-[76dvh] flex-col overflow-hidden border-2">
        <ModalHeader title={`reminder [${title}]`} onClose={onClose} />
        <div className="overflow-y-auto overscroll-contain px-4 py-4">
          <ItemReminderInfo itemId={itemId} />
        </div>
      </div>
    </Modal>
  );
}
