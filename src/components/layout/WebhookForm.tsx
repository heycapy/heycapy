import { useState, useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  deleteWebhookAction,
  saveWebhookAction,
  sendTestWebhookAction,
  type OutgoingWebhook,
} from "@/app/(app)/actions";
import { chatWebhookApp } from "@/lib/notifications/webhook-app";
import { SETTINGS_URL_MAX_LENGTH, WEBHOOK_NAME_MAX_LENGTH } from "@/constants";
import { INPUT, LABEL } from "./settings-constants";
import { ConfirmRow } from "./ConfirmRow";
import { TestSendButton } from "./TestSendButton";
import { WebhookSecret } from "./WebhookSecret";

const HINT = "text-muted-foreground font-mono text-[11px]";

type WebhookFormProps = {
  webhook: OutgoingWebhook | null;
  onSaved: (webhook: OutgoingWebhook) => void;
  onDeleted?: () => void;
  onClose: () => void;
};

export function WebhookForm({ webhook, onSaved, onDeleted, onClose }: WebhookFormProps) {
  const [name, setName] = useState(webhook?.name ?? "");
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [isDefault, setIsDefault] = useState(webhook?.isDefault ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty =
    !webhook || name !== webhook.name || url !== webhook.url || isDefault !== webhook.isDefault;
  const app = chatWebhookApp(url);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await saveWebhookAction({ id: webhook?.id ?? null, name, url, isDefault });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName(result.webhook.name);
      setUrl(result.webhook.url);
      onSaved(result.webhook);
    });
  }

  function remove() {
    if (!webhook) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteWebhookAction(webhook.id);
      if (!result.ok) setError(result.error);
      else onDeleted?.();
    });
  }

  return (
    <div className="border-border flex flex-col gap-3 border p-3">
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="work slack"
          maxLength={WEBHOOK_NAME_MAX_LENGTH}
          disabled={pending}
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>url</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/hooks/heycapy"
          maxLength={SETTINGS_URL_MAX_LENGTH}
          disabled={pending}
          className={INPUT}
        />
        {app && (
          <p className={HINT}>
            {app} link · sent as a normal {app} message
          </p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <label className={LABEL}>on for new buckets</label>
        <Toggle value={isDefault} onChange={setIsDefault} disabled={pending} />
      </div>

      {webhook && !chatWebhookApp(webhook.url) && (
        <WebhookSecret
          webhookId={webhook.id}
          secret={webhook.secret}
          onChanged={(secret) => onSaved({ ...webhook, secret })}
        />
      )}

      {webhook && !dirty && (
        <TestSendButton disabled={pending} onSend={() => sendTestWebhookAction(webhook.id)} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {dirty ? (
          <>
            <BracketButton type="button" onClick={save} disabled={pending}>
              {pending ? "saving..." : "save"}
            </BracketButton>
            <BracketButton type="button" onClick={onClose} disabled={pending}>
              cancel
            </BracketButton>
          </>
        ) : (
          <BracketButton type="button" onClick={onClose} disabled={pending}>
            done
          </BracketButton>
        )}
        {webhook &&
          (confirmDelete ? (
            <ConfirmRow
              text="delete?"
              onConfirm={remove}
              onCancel={() => setConfirmDelete(false)}
              disabled={pending}
            />
          ) : (
            <BracketButton
              type="button"
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={pending}
              className="ml-auto"
            >
              delete
            </BracketButton>
          ))}
      </div>
      {error && (
        <p role="status" className="text-destructive font-mono text-[11px]">
          {error}
        </p>
      )}
    </div>
  );
}
