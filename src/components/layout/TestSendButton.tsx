import type { ActionResult } from "@/types/result";
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
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        className="text-muted-foreground hover:text-foreground self-start font-mono text-[10px] disabled:opacity-40"
      >
        {pending ? "[sending...]" : "[send test]"}
      </button>
      {result && (
        <p
          role="status"
          className={`font-mono text-[9px] ${result.ok ? "text-muted-foreground" : "text-destructive"}`}
        >
          {result.ok ? "sent ✓ — check that it arrived" : result.error}
        </p>
      )}
    </div>
  );
}
