import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { joinBucketAction } from "@/app/(app)/actions";
import { INVITE_CODE_LENGTH } from "@/lib/buckets/constants";
import { formatInviteCode, normalizeInviteCode } from "@/lib/buckets/invite-code";

type JoinBucketDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function JoinBucketDialog({ open, onClose }: JoinBucketDialogProps) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const ready = normalizeInviteCode(code).length === INVITE_CODE_LENGTH;

  function close() {
    setCode("");
    setError("");
    onClose();
  }

  function join() {
    if (!ready || pending) return;
    setError("");
    startTransition(async () => {
      const result = await joinBucketAction(code);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      close();
      router.push(`/?bucket=${result.bucketId}`);
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
                join();
              }}
              className="border-border bg-background flex flex-col overflow-hidden border-2"
            >
              <div className="bg-foreground text-background flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="font-pixel text-xs">join a bucket</span>
                <BracketButton type="button" variant="inverted" onClick={close}>
                  x
                </BracketButton>
              </div>
              <div className="flex flex-col gap-3 px-4 py-4">
                <p className="text-muted-foreground font-mono text-[11px] leading-tight">
                  type the code someone sent you, or just open their link.
                </p>
                <input
                  value={code}
                  onChange={(e) => setCode(formatInviteCode(e.target.value))}
                  aria-label="invite code"
                  placeholder="XXXX-XXXX"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={pending}
                  className="border-border focus:border-foreground placeholder:text-muted-foreground/50 w-full border-b bg-transparent py-1.5 font-mono text-sm tracking-widest outline-none disabled:opacity-50"
                />
                {error && (
                  <p role="alert" className="text-destructive font-mono text-xs">
                    {error}
                  </p>
                )}
                <BracketButton type="submit" disabled={!ready || pending} className="w-fit">
                  {pending ? "..." : "join"}
                </BracketButton>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
