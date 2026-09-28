"use client";

import { useState, useTransition } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import type { ReminderActionOutcome } from "@/lib/reminders/quick-actions";
import { confirmReminderAction } from "./actions";

export function ConfirmReminderAction({
  token,
  title,
  label,
}: {
  token: string;
  title: string;
  label: string;
}) {
  const [outcome, setOutcome] = useState<ReminderActionOutcome | null>(null);
  const [pending, startTransition] = useTransition();

  if (outcome) {
    return (
      <p
        role="status"
        className={`font-mono text-xs ${outcome.ok ? "text-foreground" : "text-destructive"}`}
      >
        {outcome.message}
      </p>
    );
  }
  return (
    <>
      <p className="font-mono text-sm font-bold break-words">{title}</p>
      <BracketButton
        disabled={pending}
        onClick={() => startTransition(async () => setOutcome(await confirmReminderAction(token)))}
        className="text-foreground text-sm"
      >
        {pending ? "..." : label}
      </BracketButton>
    </>
  );
}
