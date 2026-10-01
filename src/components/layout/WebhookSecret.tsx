import { useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { newWebhookSecretAction } from "@/app/(app)/actions";
import { WEBHOOK_SECRET_MASK } from "@/constants";
import { LABEL } from "./settings-constants";
import { ConfirmRow } from "./ConfirmRow";

const HINT = "text-muted-foreground font-mono text-[11px]";

type WebhookSecretProps = {
  webhookId: number;
  secret: string;
  onChanged: (secret: string) => void;
};

export function WebhookSecret({ webhookId, secret, onChanged }: WebhookSecretProps) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function regenerate() {
    setError(null);
    startTransition(async () => {
      const result = await newWebhookSecretAction(webhookId);
      setConfirming(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShow(true);
      onChanged(result.secret);
    });
  }

  function copy() {
    void navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className={LABEL}>secret</label>
        <div className="flex items-center gap-2 whitespace-nowrap">
          <BracketButton type="button" onClick={() => setShow((v) => !v)}>
            {show ? "hide" : "show"}
          </BracketButton>
          <BracketButton type="button" onClick={copy}>
            {copied ? "copied" : "copy"}
          </BracketButton>
          <BracketButton
            type="button"
            variant="warning"
            onClick={() => setConfirming(true)}
            disabled={pending}
          >
            new
          </BracketButton>
        </div>
      </div>
      <p className="font-mono text-xs break-all">{show ? secret : WEBHOOK_SECRET_MASK}</p>
      {confirming ? (
        <ConfirmRow
          text="sure? your server needs the new one"
          onConfirm={regenerate}
          onCancel={() => setConfirming(false)}
          disabled={pending}
        />
      ) : (
        <p className={HINT}>
          optional · your server can use it to check that a message really came from heycapy
          (standard webhooks)
        </p>
      )}
      {error && (
        <p role="status" className="text-destructive font-mono text-[11px]">
          {error}
        </p>
      )}
    </div>
  );
}
