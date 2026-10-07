import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import { checkAIKeyAction } from "@/app/(app)/actions";
import { useAIStatus } from "@/hooks/useAIStatus";
import { useUIStore } from "@/store/ui";
import { aiStatusIsProblem, aiStatusLabel, creditsLabel } from "@/lib/ai/status-label";
import { formatShort } from "@/lib/format-date";
import { CREDITS_PER_MESSAGE } from "@/constants";
import { BOX, LABEL } from "./settings-constants";

const HINT = "text-muted-foreground font-mono text-[11px]";

export function AIStatusBox({ ownKeyPicked }: { ownKeyPicked: boolean }) {
  const status = useAIStatus();
  const tickAiRefresh = useUIStore((s) => s.tickAiRefresh);
  const [checking, startCheck] = useTransition();

  if (!status) return null;

  function check() {
    startCheck(async () => {
      await checkAIKeyAction();
      tickAiRefresh();
    });
  }

  const heycapyPicked = !ownKeyPicked && (status.kind === "credits" || status.kind === "own");
  const balance =
    status.kind === "credits" ? status.balance : status.kind === "own" ? status.credits : null;
  const ownKeySaved = status.kind === "own";

  let label: string;
  let problem: boolean;
  if (heycapyPicked) {
    label = creditsLabel(balance ?? 0);
    problem = !balance;
  } else if (status.kind === "credits") {
    label = "your own key · not saved yet";
    problem = false;
  } else {
    label = checking ? "checking your key..." : aiStatusLabel(status);
    problem = aiStatusIsProblem(status);
  }

  return (
    <div className={BOX}>
      <div className="flex items-center justify-between gap-2">
        {heycapyPicked && balance ? (
          <span
            role="status"
            aria-label="capy's ai"
            className="flex items-baseline gap-2 font-mono"
          >
            <span className="text-foreground text-2xl leading-none">{balance}</span>{" "}
            <span className="text-muted-foreground text-xs">
              capy credits left <span className="whitespace-nowrap">(never expire)</span>
            </span>
          </span>
        ) : (
          <span
            role="status"
            aria-label="capy's ai"
            className={cn("font-mono text-xs", problem ? "text-destructive" : "text-foreground")}
          >
            {label}
          </span>
        )}
        {!heycapyPicked && ownKeySaved && (
          <BracketButton onClick={check} disabled={checking}>
            check
          </BracketButton>
        )}
      </div>

      {heycapyPicked && ownKeySaved && (
        <p className={HINT}>
          save to switch to heycapy ai. your key stays saved for switching back.
        </p>
      )}
      {heycapyPicked && (
        <p className={HINT}>
          each message to capy uses {CREDITS_PER_MESSAGE} credit
          {CREDITS_PER_MESSAGE === 1 ? "" : "s"}, and talking to capy with the mic is included.
          reminders never use credits. to use none at all, pick &quot;your own key&quot; above. need
          more? see the credits tab.
        </p>
      )}

      {!heycapyPicked && balance !== null && balance > 0 && (
        <p className={LABEL}>{balance} capy credits kept for heycapy ai</p>
      )}
      {!heycapyPicked && status.kind === "credits" && (
        <p className={HINT}>
          add your key below and save: capy then answers with it, using no credits.
        </p>
      )}
      {!heycapyPicked && status.kind === "own" && status.status === "failed" && status.error && (
        <p className="text-destructive font-mono text-[11px] break-words">{status.error}</p>
      )}
      {!heycapyPicked && status.kind === "own" && status.checkedAt && (
        <p className={LABEL}>last checked: {formatShort(new Date(status.checkedAt))}</p>
      )}

      {status.kind === "server" && (
        <p className={HINT}>
          capy uses this server&apos;s ai. add your own key below to use yours.
        </p>
      )}
      {status.kind === "none" && (
        <p className={HINT}>
          this server has no ai of its own, so capy needs yours. add a key or an ollama url below
          and save.
        </p>
      )}
    </div>
  );
}
