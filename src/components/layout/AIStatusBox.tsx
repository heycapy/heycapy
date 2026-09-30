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

  const heycapyPicked = !ownKeyPicked && status.kind !== "server";
  const balance =
    status.kind === "credits" ? status.balance : status.kind === "own" ? (status.credits ?? 0) : 0;
  const ownKeySaved = status.kind === "own";

  let label: string;
  let problem: boolean;
  if (heycapyPicked) {
    label = creditsLabel(balance);
    problem = balance <= 0;
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
        <span
          role="status"
          aria-label="capy's ai"
          className={cn("font-mono text-xs", problem ? "text-destructive" : "text-foreground")}
        >
          {label}
        </span>
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
          capy answers on our ai: {CREDITS_PER_MESSAGE} credit{CREDITS_PER_MESSAGE === 1 ? "" : "s"}{" "}
          per message, and credits never expire. the mic in capy&apos;s chat is included. to use no
          credits, pick &quot;your own key&quot; above. reminders never use credits.
        </p>
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
    </div>
  );
}
