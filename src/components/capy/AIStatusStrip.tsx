import { cn } from "@/lib/utils";
import { useAIStatus } from "@/hooks/useAIStatus";
import { aiStatusIsProblem, aiStatusLabel } from "@/lib/ai/status-label";

export function AIStatusStrip() {
  const status = useAIStatus();
  const problem = status !== null && aiStatusIsProblem(status);

  return (
    <p
      role="status"
      aria-label="capy's ai"
      className={cn(
        "border-border h-6 shrink-0 truncate border-b px-2 font-mono text-[11px] leading-6",
        problem ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {status && aiStatusLabel(status)}
      {problem && " · see tweaks → ai"}
    </p>
  );
}
