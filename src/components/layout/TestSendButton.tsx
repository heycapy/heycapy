import type { ActionResult } from "@/types/result";
import { BracketButton } from "@/components/ui/BracketButton";
import { useState, useTransition } from "react";

type TestSendButtonProps = {
  onSend: () => Promise<ActionResult>;
  disabled?: boolean;
};

export function TestSendButton({ onSend, disabled }: TestSendButtonProps) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setResult(null);
    startTransition(async () => setResult(await onSend()));
  }

  return (
    <div className="flex flex-col gap-1">
      <BracketButton
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="self-start"
      >
        {pending ? "sending..." : "send test"}
      </BracketButton>
      {result && (
        <p
          role="status"
          className={`font-mono text-[11px] ${result.ok ? "text-muted-foreground" : "text-destructive"}`}
        >
          {result.ok ? "sent ✓ — check that it arrived" : result.error}
        </p>
      )}
    </div>
  );
}
