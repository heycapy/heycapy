import { useEffect, useState } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { getWebhooksAction, type OutgoingWebhook } from "@/app/(app)/actions";
import { chatWebhookApp } from "@/lib/notifications/webhook-app";
import { MAX_OUTGOING_WEBHOOKS } from "@/constants";
import { BOX, SECTION } from "./settings-constants";
import { WebhookForm } from "./WebhookForm";

const HINT = "text-muted-foreground font-mono text-[11px]";

function destination(url: string): string {
  const app = chatWebhookApp(url);
  if (app) return app;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function WebhookSettings() {
  const [webhooks, setWebhooks] = useState<OutgoingWebhook[] | null>(null);
  const [open, setOpen] = useState<number | "new" | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getWebhooksAction().then((result) => {
      if (!cancelled && result.ok) setWebhooks(result.webhooks);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function saved(webhook: OutgoingWebhook) {
    setWebhooks((list) => {
      const rest = list ?? [];
      return rest.some((w) => w.id === webhook.id)
        ? rest.map((w) => (w.id === webhook.id ? webhook : w))
        : [...rest, webhook];
    });
    setOpen(webhook.id);
  }

  return (
    <div className={BOX}>
      <span className={SECTION}>other apps</span>
      <p className={HINT}>
        send notifications to discord, slack, home assistant, n8n or your own server with its
        webhook url · up to {MAX_OUTGOING_WEBHOOKS} · pick them per bucket under channels
      </p>
      {webhooks?.map((webhook) =>
        open === webhook.id ? (
          <WebhookForm
            key={webhook.id}
            webhook={webhook}
            onSaved={saved}
            onDeleted={() => {
              setWebhooks((list) => list?.filter((w) => w.id !== webhook.id) ?? null);
              setOpen(null);
            }}
            onClose={() => setOpen(null)}
          />
        ) : (
          <div
            key={webhook.id}
            className="border-border flex items-center justify-between gap-3 border-b pb-2"
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-mono text-xs">{webhook.name}</span>
              <span className={`${HINT} truncate`}>
                {destination(webhook.url)}
                {webhook.isDefault && " · on for new buckets"}
              </span>
            </div>
            <BracketButton type="button" onClick={() => setOpen(webhook.id)}>
              edit
            </BracketButton>
          </div>
        )
      )}
      {open === "new" && (
        <WebhookForm webhook={null} onSaved={saved} onClose={() => setOpen(null)} />
      )}
      {webhooks && open !== "new" && webhooks.length < MAX_OUTGOING_WEBHOOKS && (
        <BracketButton type="button" onClick={() => setOpen("new")} className="self-start">
          add app +
        </BracketButton>
      )}
    </div>
  );
}
