import { APP_TAGLINE } from "@/constants";
import { BracketButton } from "@/components/ui/BracketButton";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { INPUT, LABEL } from "./settings-constants";
import { testSmtpAction } from "@/app/(app)/actions";

type SmtpTestDialogProps = {
  open: boolean;
  onClose: () => void;
  from: string;
  defaultTo: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string | null;
};

export function SmtpTestDialog({
  open,
  onClose,
  from,
  defaultTo,
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
}: SmtpTestDialogProps) {
  const [sendTo, setSendTo] = useState(defaultTo);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function handleSend() {
    setResult(null);
    startTransition(async () => {
      const res = await testSmtpAction({
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass: smtpPass || null,
        sendTo,
      });
      setResult(
        res.ok
          ? {
              ok: true,
              message: res.credits
                ? `sent — check your inbox. +${res.credits} capy credits`
                : "sent — check your inbox",
            }
          : { ok: false, message: res.error }
      );
    });
  }

  const mono = `'Courier New', Courier, monospace`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      layer="raised"
      className="top-1/2 max-w-md -translate-y-1/2 shadow-none sm:top-1/2"
    >
      <div className="bg-background border-border flex w-full flex-col gap-0 border-2">
        <ModalHeader title="send test email" onClose={onClose} />

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>from</label>
            <div className={cn(INPUT, "text-muted-foreground cursor-not-allowed opacity-60")}>
              {from || "—"}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>to</label>
            <input
              type="text"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              placeholder="recipient@example.com"
              className={INPUT}
              autoComplete="off"
            />
          </div>

          <div className="border-border flex flex-col gap-2 border p-3">
            <span className="text-muted-foreground font-mono text-[11px] tracking-widest uppercase">
              preview
            </span>
            <div
              style={{ fontFamily: mono }}
              className="border-border flex flex-col border text-[11px]"
            >
              <div className="border-border border-b px-3 py-2">
                <p className="text-[11px]">
                  <span className="font-bold">heycapy</span>
                  <span className="text-muted-foreground"> · smtp test</span>
                </p>
              </div>
              <div className="px-3 py-3">
                <p className="text-foreground text-[12px]">your smtp is working correctly.</p>
              </div>
              <div className="border-border border-t px-3 py-2">
                <p className="text-muted-foreground text-xs">{APP_TAGLINE}</p>
              </div>
            </div>
          </div>

          {result && (
            <p
              className={cn(
                "font-mono text-xs",
                result.ok ? "text-green-600 dark:text-green-400" : "text-destructive"
              )}
            >
              {result.message}
            </p>
          )}

          <div className="flex justify-end">
            <BracketButton
              type="button"
              onClick={handleSend}
              disabled={pending || !sendTo || !smtpHost}
            >
              {pending ? "sending..." : "send"}
            </BracketButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
