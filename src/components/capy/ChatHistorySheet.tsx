import { Modal, ModalHeader } from "@/components/ui/Modal";
import type { ChatMessage } from "./chatTypes";
import { ChatSessionList } from "./ChatSessionList";

type Props = {
  open: boolean;
  activeId: number | null;
  onClose: () => void;
  onLoadSession: (id: number, msgs: ChatMessage[]) => void;
  onNewChat: () => void;
};

export function ChatHistorySheet({ open, activeId, onClose, onLoadSession, onNewChat }: Props) {
  return (
    <Modal open={open} onClose={onClose} variant="sheet">
      <ModalHeader title="chat history" onClose={onClose} />
      <ChatSessionList
        enabled={open}
        activeId={activeId}
        onLoadSession={onLoadSession}
        onNewChat={onNewChat}
        onDone={onClose}
      />
    </Modal>
  );
}
