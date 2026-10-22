import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BracketButton } from "@/components/ui/BracketButton";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { BetaTag } from "@/components/ui/BetaTag";
import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
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
    <Modal open={open} onClose={close} label="join a bucket">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          join();
        }}
        className={cn(
          "border-border bg-background flex flex-col overflow-hidden border-2",
          ACCENT_BUTTONS
        )}
      >
        <ModalHeader
          title={
            <>
              join a bucket
              <BetaTag feature="sharing" />
            </>
          }
          onClose={close}
        />
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
        </div>
        <div className="border-border flex justify-end border-t px-3 py-2.5">
          <BracketButton type="submit" disabled={!ready || pending}>
            {pending ? "..." : "join"}
          </BracketButton>
        </div>
      </form>
    </Modal>
  );
}
