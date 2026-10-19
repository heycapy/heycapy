import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BracketButton } from "@/components/ui/BracketButton";
import {
  switchTimezoneAction,
  timezoneMoveAction,
  type TimezoneMove,
} from "@/app/(app)/user-settings-actions";
import { useTimezoneStore } from "@/store/timezone";

const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function TimezoneMoveBanner() {
  const router = useRouter();
  const [move, setMove] = useState<TimezoneMove | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const keptIn = useTimezoneStore((s) => s.keptIn);
  const keep = useTimezoneStore((s) => s.keep);
  const hydrated = useSyncExternalStore(
    (onChange) => useTimezoneStore.persist.onFinishHydration(onChange),
    () => useTimezoneStore.persist.hasHydrated(),
    () => false
  );

  useEffect(() => {
    let cancelled = false;
    void timezoneMoveAction(browserTimezone()).then((result) => {
      if (!cancelled) setMove(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hydrated || !move || keptIn === browserTimezone()) return null;

  function handleUpdate() {
    setError("");
    startTransition(async () => {
      const result = await switchTimezoneAction(browserTimezone());
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMove(null);
      router.refresh();
    });
  }

  return (
    <div className="px-4 pt-3">
      <div
        role="status"
        className="border-border text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 border border-dashed px-3 py-2 font-mono text-xs"
      >
        <span className="min-w-64 flex-1">
          you seem to be in {move.here} now · reminders still run on {move.saved} time
        </span>
        <div className="flex shrink-0 gap-2">
          <BracketButton onClick={handleUpdate} disabled={pending}>
            update
          </BracketButton>
          <BracketButton onClick={() => keep(browserTimezone())} disabled={pending}>
            keep {move.saved}
          </BracketButton>
        </div>
        {error && <span className="text-destructive w-full">{error}</span>}
      </div>
    </div>
  );
}
