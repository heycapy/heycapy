"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { BracketButton } from "@/components/ui/BracketButton";
import { getWebhookKeyAction, rotateWebhookKeyAction } from "@/app/(app)/actions";
import type { buckets } from "@/lib/db/schema";
import type { BucketSchema } from "@/types/rules";

type BucketRow = typeof buckets.$inferSelect;

const LABEL = "text-muted-foreground font-mono text-[10px]";
const HINT = "text-muted-foreground/50 font-mono text-[9px] leading-tight";

function buildWebhookUrl(bucketId: number): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/api/webhook/${bucketId}`;
}

function buildCurlCommand(url: string, key: string, schema: BucketSchema | null): string {
  const payload = buildExamplePayload(schema);
  return `curl -X POST ${url} \\\n  -H "Authorization: Bearer ${key}" \\\n  -H "Content-Type: application/json" \\\n  -d '${payload.replace(/\n/g, "\n  ")}'`;
}

function buildExamplePayload(schema: BucketSchema | null): string {
  const payload: Record<string, unknown> = { title: "My item title" };
  if (schema?.statuses && schema.statuses.length > 0) {
    payload.status = schema.statuses[0].name;
  }
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  payload.deadline = sevenDaysFromNow.toISOString().replace(/\.\d{3}Z$/, "Z");
  if (schema) {
    for (const field of schema.fields) {
      switch (field.type) {
        case "text":
        case "textarea":
          payload[field.key] = `example ${field.label}`;
          break;
        case "url":
          payload[field.key] = "https://example.com";
          break;
        case "number":
        case "currency":
          payload[field.key] = 42;
          break;
        case "boolean":
          payload[field.key] = true;
          break;
        case "date": {
          const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          payload[field.key] = d.toISOString().slice(0, 10);
          break;
        }
        case "datetime": {
          const dt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          payload[field.key] = dt.toISOString().replace(/\.\d{3}Z$/, "Z");
          break;
        }
        case "select":
          payload[field.key] = field.options?.[0] ?? "option1";
          break;
        case "multiselect":
          payload[field.key] = [field.options?.[0] ?? "option1"];
          break;
      }
    }
  }
  return JSON.stringify(payload, null, 2);
}

interface WebhookPanelProps {
  bucket: BucketRow;
}

export function WebhookPanel({ bucket }: WebhookPanelProps) {
  const [key, setKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const [curlCopied, setCurlCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const webhookUrl = buildWebhookUrl(bucket.id);

  const schema: BucketSchema | null = (() => {
    try {
      const raw = bucket.fieldSchema as unknown as string | null | undefined;
      if (!raw) return null;
      return JSON.parse(raw) as BucketSchema;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    void getWebhookKeyAction(bucket.id).then((r) => {
      if (r.ok) setKey(r.key);
    });
  }, [bucket.id]);

  function copyKey() {
    if (!key) return;
    void navigator.clipboard.writeText(key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyUrl() {
    void navigator.clipboard.writeText(webhookUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  }

  function handleRotate() {
    startTransition(async () => {
      const result = await rotateWebhookKeyAction(bucket.id);
      if (result.ok) {
        setKey(result.key);
        setRevealed(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>endpoint url</label>
        <span className={HINT}>POST to this URL to create an item in this bucket</span>
        <div className="flex items-center gap-2">
          <code className="border-border text-muted-foreground flex-1 overflow-hidden border bg-transparent px-2 py-1 font-mono text-[9px] text-ellipsis">
            {webhookUrl}
          </code>
          <button
            onClick={copyUrl}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          >
            <Copy size={11} />
          </button>
        </div>
        {urlCopied && <span className="text-muted-foreground font-mono text-[9px]">copied!</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className={LABEL}>secret key</label>
        <span className={HINT}>
          send as Authorization: Bearer {"<key>"} — rotate to invalidate the old key
        </span>
        <div className="flex items-center gap-2">
          <code className="border-border text-muted-foreground flex-1 overflow-hidden border bg-transparent px-2 py-1 font-mono text-[9px] text-ellipsis">
            {key ? (revealed ? key : "hc_live_" + "•".repeat(32)) : "loading..."}
          </code>
          <button
            onClick={() => setRevealed((v) => !v)}
            disabled={!key}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors disabled:opacity-30"
          >
            {revealed ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <button
            onClick={copyKey}
            disabled={!key}
            className="text-muted-foreground hover:text-foreground shrink-0 transition-colors disabled:opacity-30"
          >
            <Copy size={11} />
          </button>
        </div>
        {copied && <span className="text-muted-foreground font-mono text-[9px]">copied!</span>}
        <BracketButton
          onClick={handleRotate}
          disabled={pending}
          className="mt-1 flex w-fit items-center gap-1.5"
        >
          <RefreshCw size={10} />
          rotate key
        </BracketButton>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className={LABEL}>test with curl</label>
          {key && (
            <button
              onClick={() => {
                void navigator.clipboard
                  .writeText(buildCurlCommand(webhookUrl, key, schema))
                  .then(() => {
                    setCurlCopied(true);
                    setTimeout(() => setCurlCopied(false), 2000);
                  });
              }}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <Copy size={10} />
              <span className="font-mono text-[9px]">{curlCopied ? "copied!" : "copy"}</span>
            </button>
          )}
        </div>
        <span className={HINT}>paste this in your terminal to create a test item</span>
        <pre className="border-border text-muted-foreground overflow-x-auto border bg-transparent p-2 font-mono text-[9px]">
          {key ? buildCurlCommand(webhookUrl, key, schema) : buildExamplePayload(schema)}
        </pre>
      </div>
    </div>
  );
}
