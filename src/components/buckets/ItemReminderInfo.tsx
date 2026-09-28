import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { getItemReminderInfoAction } from "@/app/(app)/actions";
import type {
  ChannelOutcome,
  ItemReminderInfo as Info,
  NotificationEvent,
} from "@/lib/reminders/status";
import { formatShort } from "@/lib/format-date";

const REASONS: Record<NonNullable<Info["reason"]>, string> = {
  completed: "completed",
  onHold: "no reminders — item is on hold",
  missed: "missed — the next occurrence took its place",
  noChannel: "no reminder — this bucket has no working channel",
  alreadyReminded: "no further reminders (repeat: once)",
};

const KINDS: Record<NonNullable<NotificationEvent["kind"]>, string> = {
  reminder: "reminder",
  overdue: "overdue alert",
  arrival: "new item",
};

const OUTCOMES: Record<ChannelOutcome["outcome"], { text: string; className: string }> = {
  sent: { text: "✓ sent", className: "" },
  sending: { text: "… sending", className: "text-muted-foreground" },
  retrying: { text: "↻ retrying", className: "text-warning" },
  failed: { text: "✗ failed", className: "text-destructive" },
  closed: { text: "– not sent, item was closed first", className: "text-muted-foreground" },
  notSelected: { text: "– not selected for this bucket", className: "text-muted-foreground" },
  notSetUp: { text: "– not set up at the time", className: "text-muted-foreground" },
};

function statusLine(info: Info): string {
  if (info.next) return `next ${formatShort(info.next)}`;
  if (info.reason === "completed" && info.completedAt) {
    return `completed ${formatShort(info.completedAt)}`;
  }
  return info.reason ? REASONS[info.reason] : "";
}

function goesTo(info: Info): string | null {
  if (!info.nextChannels) return null;
  const sends = info.nextChannels.filter((c) => c.state === "send").map((c) => c.medium);
  const others = info.nextChannels
    .filter((c) => c.state !== "send")
    .map((c) => `${c.medium} ${c.state === "notSelected" ? "not selected" : "not set up"}`);
  return `goes to ${sends.join(", ")}${others.length ? ` (${others.join(" · ")})` : ""}`;
}

function outcomeText(c: ChannelOutcome): string {
  const base = OUTCOMES[c.outcome].text;
  const retry = c.retryAt ? ` at ${formatShort(c.retryAt)}` : "";
  return `${base}${retry}${c.error ? ` — ${c.error}` : ""}`;
}

export function ItemReminderInfo({ itemId }: { itemId: number }) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getItemReminderInfoAction(itemId).then((result) => {
      if (!cancelled) setInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  if (!info) return null;
  const route = goesTo(info);

  return (
    <section aria-label="reminders" className="flex flex-col gap-3 font-mono text-[10px]">
      <div>
        <p className="text-muted-foreground">status</p>
        <p>{statusLine(info)}</p>
        {route && <p className="text-muted-foreground">{route}</p>}
      </div>

      <div>
        <p className="text-muted-foreground">history</p>
        {info.history.length === 0 ? (
          <p className="text-muted-foreground">nothing sent yet</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {info.history.map((event, i) => (
              <li key={i}>
                <p>
                  {formatShort(event.at)} · {event.kind ? KINDS[event.kind] : "notification"}
                </p>
                {event.channels.map((c) => (
                  <p
                    key={c.medium}
                    className={cn("pl-3 break-words", OUTCOMES[c.outcome].className)}
                  >
                    {c.medium} {outcomeText(c)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
