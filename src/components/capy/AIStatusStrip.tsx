import { cn } from "@/lib/utils";
import { useAIStatus } from "@/hooks/useAIStatus";
import { aiStatusIsProblem, aiStatusLabel } from "@/lib/ai/status-label";
import { CREDITS_LOW_LEFT } from "@/constants";

export function AIStatusStrip() {
  const status = useAIStatus();
  if (!status || (status.kind === "credits" && status.balance > CREDITS_LOW_LEFT)) return null;
  const problem = aiStatusIsProblem(status);

  return (
    <p
      role="status"
      aria-label="capy's ai"
      className={cn(
        "border-border h-6 shrink-0 truncate border-b px-2 font-mono text-[11px] leading-6",
        problem ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {aiStatusLabel(status)}
      {status.kind === "credits" ? " · see tweaks → credits" : problem && " · see tweaks → ai"}
    </p>
  );
}
