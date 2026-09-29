import { useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { deleteAccountAction, sendAccountDeletionCodeAction } from "@/app/(app)/actions";
import { BOX, INPUT, LABEL, SECTION } from "./settings-constants";

type Step = "idle" | "confirm" | "code";

export function AccountTab({ email }: { email: string }) {
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setStep("idle");
    setCode("");
    setDevCode("");
    setError("");
  }

  function sendCode() {
    setError("");
    startTransition(async () => {
      const result = await sendAccountDeletionCodeAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDevCode(result.devCode ?? "");
      setStep("code");
    });
  }

  function confirmDelete() {
    setError("");
    startTransition(async () => {
      // On success the action redirects to the login page
      const result = await deleteAccountAction(code);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={BOX}>
        <span className={SECTION}>your data</span>
        <p className={LABEL}>
          one file with your buckets, items, settings, notification history and chats. secrets like
          api keys and passwords are never included.
        </p>
        <a
          href="/api/account/export"
          download
          className="text-muted-foreground hover:text-foreground self-start font-mono text-xs"
        >
          <span className="opacity-50">[</span>download my data<span className="opacity-50">]</span>
        </a>
      </div>

      <div className={BOX}>
        <span className={SECTION}>delete account</span>
        {step === "idle" && (
          <>
            <p className={LABEL}>permanently deletes {email} and everything in it.</p>
            <BracketButton
              variant="destructive"
              onClick={() => setStep("confirm")}
              className="self-start"
            >
              delete account
            </BracketButton>
          </>
        )}

        {step === "confirm" && (
          <>
            <p className="text-destructive font-mono text-[11px] leading-relaxed">
              this deletes everything: buckets, items, history, settings and your telegram
              connection. it can&apos;t be undone. copies in the nightly backups are gone within 7
              days. download your data first if you want to keep it.
            </p>
            <div className="flex gap-3">
              <BracketButton variant="destructive" onClick={sendCode} disabled={pending}>
                {pending ? "sending..." : "email me a code"}
              </BracketButton>
              <BracketButton onClick={reset} disabled={pending}>
                cancel
              </BracketButton>
            </div>
          </>
        )}

        {step === "code" && (
          <>
            <p className={LABEL}>enter the 6-digit code we sent to {email}</p>
            {devCode && <p className={LABEL}>dev code: {devCode}</p>}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label="deletion code"
              placeholder="000000"
              disabled={pending}
              className={INPUT}
            />
            <div className="flex gap-3">
              <BracketButton
                variant="destructive"
                onClick={confirmDelete}
                disabled={pending || code.length !== 6}
              >
                {pending ? "deleting..." : "delete forever"}
              </BracketButton>
              <BracketButton onClick={reset} disabled={pending}>
                cancel
              </BracketButton>
            </div>
          </>
        )}

        {error && (
          <p role="alert" className="text-destructive font-mono text-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
