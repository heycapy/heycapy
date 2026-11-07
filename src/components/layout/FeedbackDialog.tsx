import { useState, useTransition } from "react";
import { TextButton } from "@/components/ui/TextButton";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
import { sendFeedbackAction } from "@/app/(app)/actions";
import { FEEDBACK_MAX_LENGTH } from "@/constants";

type FeedbackDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();
  const ready = message.trim() !== "" && !pending;

  function close() {
    setMessage("");
    setError("");
    setSent(false);
    onClose();
  }

  function send() {
    if (!ready) return;
    setError("");
    startTransition(async () => {
      const result = await sendFeedbackAction(
        message,
        window.location.pathname + window.location.search
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("");
      setSent(true);
    });
  }

  return (
    <Modal open={open} onClose={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (sent) close();
          else send();
        }}
        className={cn(
          "border-border bg-background rounded-panel border-frame flex flex-col overflow-hidden",
          ACCENT_BUTTONS
        )}
      >
        <ModalHeader title="feedback" onClose={close} />
        <div className="flex flex-col gap-3 px-4 py-4">
          {sent ? (
            <p role="status" className="font-ui text-xs">
              got it. thanks.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground font-ui text-2xs leading-tight">
                something broke, or something you&apos;d like? the page you&apos;re on, the app
                version and your browser go with it, and the reply comes to your email.
              </p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                aria-label="feedback"
                placeholder="say something..."
                maxLength={FEEDBACK_MAX_LENGTH}
                rows={4}
                autoFocus
                disabled={pending}
                className="border-border focus:border-foreground placeholder:text-muted-foreground/50 font-ui w-full resize-none border-b bg-transparent py-1.5 text-sm leading-relaxed outline-none disabled:opacity-50"
              />
              {error && (
                <p role="alert" className="text-destructive font-ui text-xs">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
        <div className="border-border flex justify-end border-t px-3 py-2.5">
          {sent ? (
            <TextButton type="submit">close</TextButton>
          ) : (
            <TextButton type="submit" disabled={!ready}>
              {pending ? "..." : "send"}
            </TextButton>
          )}
        </div>
      </form>
    </Modal>
  );
}
