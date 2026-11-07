import { useEffect, useState, useTransition } from "react";
import { getCreditPacksAction, startCheckoutAction } from "@/app/(app)/billing-actions";
import type { PackOffer } from "@/lib/billing/dodo";
import { TextButton } from "@/components/ui/TextButton";
import { BOX, HINT } from "./settings-constants";

function centsPerMessage(pack: PackOffer): string {
  return ((pack.usd / pack.credits) * 100).toFixed(2);
}

export function BuyCredits() {
  const [packs, setPacks] = useState<PackOffer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getCreditPacksAction().then((result) => {
      if (!cancelled && result.ok) setPacks(result.packs);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (packs === null) return null;
  if (packs.length === 0) {
    return (
      <div className={BOX}>
        <span className="text-foreground font-ui text-xs">buy capy credits</span>
        <p className={HINT}>buying credits isn&apos;t open yet.</p>
      </div>
    );
  }

  function buy(pack: PackOffer) {
    setError(null);
    startOpening(async () => {
      const result = await startCheckoutAction(pack.id);
      if (result.ok) window.location.assign(result.url);
      else setError(result.error);
    });
  }

  return (
    <div className={BOX}>
      <span className="text-foreground font-ui text-xs">buy capy credits</span>
      <p className={HINT}>one payment, no subscription. use them whenever you like.</p>
      <div className="flex flex-col gap-2">
        {packs.map((pack) => (
          <div
            key={pack.id}
            className="border-border flex items-center justify-between gap-3 border p-2.5"
          >
            <div className="font-ui flex flex-col gap-0.5">
              <span className="text-foreground text-sm">
                {pack.credits.toLocaleString("en")} credits
              </span>
              <span className={HINT}>
                = {pack.credits.toLocaleString("en")} messages to capy · {centsPerMessage(pack)}¢
                per message
              </span>
            </div>
            <TextButton onClick={() => buy(pack)} disabled={opening} className="shrink-0">
              buy for ${pack.usd}
            </TextButton>
          </div>
        ))}
      </div>
      {error && <p className="text-destructive font-ui text-2xs">{error}</p>}
      <p className={HINT}>
        taxes included, credits never expire. you pay on dodo payments&apos; page and come back
        here.
      </p>
    </div>
  );
}
