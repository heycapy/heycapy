import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  adjustUserCreditsAction,
  getUserCreditsAction,
  type UserCredits,
} from "@/app/(app)/actions";
import { formatShort } from "@/lib/format-date";
import { CREDITS_NOTE_MAX_LENGTH } from "@/constants";
import { BOX, INPUT, LABEL, SECTION } from "./settings-constants";

export function SystemCredits() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function lookUp() {
    setError("");
    startTransition(async () => {
      const result = await getUserCreditsAction(email);
      if (result.ok) setCredits(result.credits);
      else {
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
          className={INPUT}
        />
        <BracketButton type="submit" disabled={pending || !email.trim()}>
          look up
        </BracketButton>
      </form>

      {credits && (
        <>
          <p className="font-mono text-xs">
            {credits.email} · {credits.balance} credits
          </p>
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
          <ul className="divide-border/50 flex flex-col divide-y divide-dotted">
            {credits.rows.map((row) => (
              <li key={row.id} className={cn(LABEL, "flex justify-between gap-2 py-1")}>
                <span className="min-w-0 break-words">
                  {formatShort(new Date(row.createdAt))} · {row.kind}
                  {row.note && ` · ${row.note}`}
                  {row.actor && ` · by ${row.actor}`}
                </span>
                <span className={row.amount > 0 ? "text-foreground" : ""}>
                  {row.amount > 0 ? `+${row.amount}` : row.amount}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && <p className="text-destructive font-mono text-xs">{error}</p>}
    </div>
  );
}
