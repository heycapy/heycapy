import { useAIStatus } from "@/hooks/useAIStatus";
import { CREDITS_PER_MESSAGE, PRICING_URL, REFUNDS_URL } from "@/constants";
import { BuyCredits } from "./BuyCredits";
import { BOX } from "./settings-constants";

const HINT = "text-muted-foreground font-mono text-[11px]";

export function CreditsTab() {
  const status = useAIStatus();
  if (!status) return null;
  const balance =
    status.kind === "credits" ? status.balance : status.kind === "own" ? status.credits : null;
  if (balance === null) return null;

  return (
    <>
      <div className={BOX}>
        <span
          role="status"
          aria-label="capy credits"
          className="flex items-baseline gap-2 font-mono"
        >
          <span className="text-foreground text-2xl leading-none">{balance}</span>
          <span className="text-muted-foreground text-xs">
            capy credits left <span className="whitespace-nowrap">(never expire)</span>
          </span>
        </span>
        <p className={HINT}>
          each message to capy uses {CREDITS_PER_MESSAGE} credit
          {CREDITS_PER_MESSAGE === 1 ? "" : "s"}, and talking to capy with the mic is included.
          adding items yourself and reminders never use credits.
        </p>
        {status.kind === "own" && (
          <p className={HINT}>
            capy is answering with your own key right now, so no credits are used. switch to heycapy
            ai in the ai tab to use these.
          </p>
        )}
      </div>
      <BuyCredits />
      <p className={HINT}>
        questions about prices or refunds? see{" "}
        <a href={PRICING_URL} target="_blank" rel="noreferrer" className="underline">
          pricing
        </a>{" "}
        and{" "}
        <a href={REFUNDS_URL} target="_blank" rel="noreferrer" className="underline">
          refunds
        </a>
        .
      </p>
    </>
  );
}
