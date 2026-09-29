import { APP_TAGLINE } from "@/constants";
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
  smtpSecure: boolean;
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
  smtpSecure,
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
        smtpSecure,
        sendTo,
      });
      setResult(
        res.ok
          ? { ok: true, message: "sent — check your inbox" }
          : { ok: false, message: res.error }
      );
    });
  }

  if (!open) return null;

  const mono = `'Courier New', Courier, monospace`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="bg-background border-border relative z-10 flex w-full max-w-md flex-col gap-0 border-2">
        <div className="bg-foreground text-background flex items-center justify-between px-3 py-1.5">
          <span className="font-pixel text-xs">send test email</span>
          <button type="button" onClick={onClose} className="font-mono text-xs hover:opacity-70">
            [x]
          </button>
        </div>

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
            <button
              type="button"
              onClick={handleSend}
              disabled={pending || !sendTo || !smtpHost}
              className="text-muted-foreground hover:text-foreground font-mono text-xs disabled:opacity-40"
            >
              {pending ? "[sending...]" : "[send]"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
