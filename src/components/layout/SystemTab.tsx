import { useEffect, useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { getSystemStatusAction, type SystemStatus } from "@/app/(app)/actions";
import { formatShort } from "@/lib/format-date";
import { BOX, LABEL, SECTION } from "./settings-constants";
import { SystemCredits } from "./SystemCredits";

// Stored as JSON (stack, context, runtime); shown as readable lines
function formatDetails(raw: string): string {
  try {
    const { stack, context, runtime } = JSON.parse(raw) as {
      stack?: string;
      context?: unknown;
      runtime?: unknown;
    };
    return [
      context ? `context: ${JSON.stringify(context, null, 2)}` : "",
      runtime ? `runtime: ${JSON.stringify(runtime)}` : "",
      stack ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");
  } catch {
    return raw;
  }
}

export function SystemTab() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const result = await getSystemStatusAction();
      if (result.ok) {
        setStatus(result.status);
        setError("");
      } else setError(result.error);
    });
  }

  useEffect(load, []);

  if (error) return <p className="text-destructive font-mono text-xs">{error}</p>;
  if (!status) return <p className="text-muted-foreground font-mono text-xs">loading...</p>;

  const { scheduler } = status;
  return (
    <div className="flex flex-col gap-3">
      <div className={BOX}>
        <div className="flex items-center justify-between">
          <span className={SECTION}>scheduler</span>
          <BracketButton onClick={load} disabled={pending}>
            {pending ? "refreshing..." : "refresh"}
          </BracketButton>
        </div>
        <p
          role="status"
          className={`font-mono text-xs ${scheduler.stale ? "text-destructive" : "text-foreground"}`}
        >
          {scheduler.stale ? "⚠ stuck — no finished run recently" : "✓ running"}
        </p>
        <p className={LABEL}>
          last run: {scheduler.lastRunAt ? formatShort(new Date(scheduler.lastRunAt)) : "not yet"}
        </p>
        <p className={LABEL}>failed deliveries in the last 24h: {status.failedDeliveriesLastDay}</p>
      </div>

      {status.hosted && <SystemCredits />}

      <div className={BOX}>
        <span className={SECTION}>recent errors</span>
        {status.errors.length === 0 ? (
          <p className={LABEL}>none in the last 14 days</p>
        ) : (
          <ul className="divide-border/50 flex flex-col divide-y divide-dotted">
            {status.errors.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 py-1.5 font-mono text-xs">
                <span className="text-muted-foreground">
                  {formatShort(new Date(e.createdAt))} · {e.level} · {e.source}
                  {e.userId !== null && ` · user ${e.userId}`}
                </span>
                <span className="text-destructive break-words">{e.message}</span>
                {e.details && (
                  <details>
                    <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
                      details
                    </summary>
                    <pre className="text-muted-foreground mt-1 max-h-60 overflow-auto text-[11px] whitespace-pre-wrap">
                      {formatDetails(e.details)}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
