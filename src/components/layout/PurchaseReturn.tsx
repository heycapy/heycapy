import { useEffect } from "react";
import { toast } from "sonner";
import { CHECKOUT_BALANCE_RECHECK_SECONDS, CHECKOUT_RETURN_PARAMS } from "@/constants";
import { useUIStore } from "@/store/ui";

//NOTE: dodo sends the buyer back with the result in the address; it only decides the message, the credits come from the webhook
export function PurchaseReturn({ onPaid }: { onPaid: () => void }) {
  const tickAiRefresh = useUIStore((s) => s.tickAiRefresh);

  useEffect(() => {
    const url = new URL(window.location.href);
    const status = url.searchParams.get("status");
    if (!url.searchParams.get("payment_id") || !status) return;

    for (const param of CHECKOUT_RETURN_PARAMS) url.searchParams.delete(param);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);

    if (status !== "success") {
      toast.error("the payment didn't go through. you weren't charged.");
      return;
    }
    toast.success("payment received. your credits arrive in a moment.");
    onPaid();
    const timers = CHECKOUT_BALANCE_RECHECK_SECONDS.map((seconds) =>
      setTimeout(tickAiRefresh, seconds * 1000)
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
