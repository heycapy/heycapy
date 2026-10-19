import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
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
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.45 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[55] bg-black"
            onClick={close}
          />
          <motion.div
            key="dialog"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[8%] left-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 shadow-[5px_5px_0_var(--border)] sm:top-[12%]"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (sent) close();
                else send();
              }}
              className={cn(
                "border-border bg-background flex flex-col overflow-hidden border-2",
                ACCENT_BUTTONS
              )}
            >
              <div className="bg-foreground text-background flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="font-pixel text-xs">feedback</span>
                <BracketButton type="button" variant="inverted" onClick={close}>
                  x
                </BracketButton>
              </div>
              <div className="flex flex-col gap-3 px-4 py-4">
                {sent ? (
                  <p role="status" className="font-mono text-xs">
                    got it. thanks.
                  </p>
                ) : (
                  <>
                    <p className="text-muted-foreground font-mono text-[11px] leading-tight">
                      something broke, or something you&apos;d like? the page you&apos;re on, the
                      app version and your browser go with it, and the reply comes to your email.
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
                      className="border-border focus:border-foreground placeholder:text-muted-foreground/50 w-full resize-none border-b bg-transparent py-1.5 font-mono text-sm leading-relaxed outline-none disabled:opacity-50"
                    />
                    {error && (
                      <p role="alert" className="text-destructive font-mono text-xs">
                        {error}
                      </p>
                    )}
                  </>
                )}
              </div>
              <div className="border-border flex justify-end border-t px-3 py-2.5">
                {sent ? (
                  <BracketButton type="submit">close</BracketButton>
                ) : (
                  <BracketButton type="submit" disabled={!ready}>
                    {pending ? "..." : "send"}
                  </BracketButton>
                )}
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
