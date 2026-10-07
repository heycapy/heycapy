import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  adjustUserCreditsAction,
  getUserCreditsAction,
  type UserCredits,
} from "@/app/(app)/actions";
import type { CreditRow } from "@/lib/credits";
import { formatShort } from "@/lib/format-date";
import { CREDITS_NOTE_MAX_LENGTH, CREDITS_RECENT_DAYS } from "@/constants";
import { BOX, INPUT, LABEL, SECTION } from "./settings-constants";

// four places since one answer costs a fraction of a cent
function dollars(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(4)}`;
}

function activityDetail(row: CreditRow): string {
  return [row.note, row.actor && `by ${row.actor}`].filter(Boolean).join(" · ");
}

export function SystemCredits() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [showActivity, setShowActivity] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function lookUp() {
    setError("");
    startTransition(async () => {
      const result = await getUserCreditsAction(email);
      if (result.ok) {
        setCredits(result.credits);
        setShowActivity(false);
      } else {
        setCredits(null);
        setError(result.error);
      }
    });
  }

  function adjust() {
    if (!credits) return;
    setError("");
    startTransition(async () => {
      const result = await adjustUserCreditsAction({
        email: credits.email,
        amount: Number(amount),
        note,
      });
      if (result.ok) {
        setCredits(result.credits);
        setAmount("");
        setNote("");
      } else setError(result.error);
    });
  }

  return (
    <div className={BOX}>
      <span className={SECTION}>credits</span>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          lookUp();
        }}
      >
        <input
          type="email"
          aria-label="user email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user's email"
          disabled={pending}
          className={cn(INPUT, "min-w-0 flex-1")}
        />
        <BracketButton
          type="submit"
          disabled={pending || !email.trim()}
          className="shrink-0 whitespace-nowrap"
        >
          look up
        </BracketButton>
      </form>

      {credits && (
        <>
          <div className="flex flex-col gap-0.5">
            <p className={cn(LABEL, "break-all")}>{credits.email}</p>
            <p className="font-mono text-xs">{credits.balance} credits</p>
            <p className={LABEL}>
              {credits.totals.grant + credits.totals.purchase} granted ·{" "}
              {-(credits.totals.message + credits.totals.refund)} used · {credits.totals.refund}{" "}
              refunded · {-credits.totals.reversal} taken back · {credits.totals.admin} by admins
            </p>
            <p className={LABEL}>
              last {CREDITS_RECENT_DAYS} days · {credits.recent.creditsUsed} used ·{" "}
              {dollars(credits.recent.costMicros)} on our ai
              {credits.recent.unpricedCalls > 0 &&
                ` · ${credits.recent.unpricedCalls} calls without a price`}
            </p>
          </div>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              adjust();
            }}
          >
            <div className="flex items-end gap-2">
              <input
                type="number"
                aria-label="credits to give"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="+50 or -10"
                disabled={pending}
                className={cn(INPUT, "w-24 shrink-0")}
              />
              <input
                type="text"
                aria-label="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="note (optional)"
                maxLength={CREDITS_NOTE_MAX_LENGTH}
                disabled={pending}
                className={INPUT}
              />
            </div>
            <BracketButton type="submit" disabled={pending || !amount} className="self-end">
              {Number(amount) < 0 ? "take" : "give"}
            </BracketButton>
          </form>
          <BracketButton
            type="button"
            onClick={() => setShowActivity((v) => !v)}
            className="self-start"
          >
            {showActivity ? "hide activity" : "show activity"}
          </BracketButton>
          {showActivity && (
            <ul className="divide-border/50 border-border flex max-h-48 flex-col divide-y divide-dotted overflow-y-auto border px-2">
              {credits.rows.map((row) => (
                <li key={row.id} className={cn(LABEL, "flex flex-col py-1")}>
                  <span className="flex justify-between gap-2">
                    <span>
                      {formatShort(new Date(row.createdAt))} · {row.kind}
                    </span>
                    <span className={cn("shrink-0", row.amount > 0 && "text-foreground")}>
                      {row.amount > 0 ? `+${row.amount}` : row.amount}
                    </span>
                  </span>
                  {(row.note || row.actor) && (
                    <span className="truncate text-[11px]" title={activityDetail(row)}>
                      {activityDetail(row)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && <p className="text-destructive font-mono text-xs">{error}</p>}
    </div>
  );
}
