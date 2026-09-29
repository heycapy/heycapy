import { useEffect, useState, useTransition } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { TimePicker } from "@/components/ui/TimePicker";
import { BracketButton } from "@/components/ui/BracketButton";
import { getQuietHoursAction, saveQuietHoursAction } from "@/app/(app)/actions";
import { formatSlot } from "@/lib/format-date";
import { BOX, DEFAULT_QUIET_FROM, DEFAULT_QUIET_TO, LABEL, SECTION } from "./settings-constants";

const HINT = "text-muted-foreground font-mono text-[11px]";

type Saved = { from: string | null; to: string | null };

export function QuietHoursSettings() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [from, setFrom] = useState(DEFAULT_QUIET_FROM);
  const [to, setTo] = useState(DEFAULT_QUIET_TO);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void getQuietHoursAction().then((result) => {
      if (cancelled || !result.ok) return;
      setSaved({ from: result.from, to: result.to });
      setEnabled(result.from !== null);
      if (result.from && result.to) {
        setFrom(result.from);
        setTo(result.to);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const wanted: Saved = enabled ? { from, to } : { from: null, to: null };
  const dirty = saved !== null && (wanted.from !== saved.from || wanted.to !== saved.to);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveQuietHoursAction(wanted.from, wanted.to);
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setSaved(wanted);
      setMessage({ ok: true, text: "saved ✓" });
    });
  }

  return (
    <div className={BOX}>
      <span className={SECTION}>quiet hours</span>
      <div className="flex items-center justify-between">
        <label className={LABEL}>don&apos;t send anything at night</label>
        <Toggle value={enabled} onChange={setEnabled} disabled={saved === null || pending} />
      </div>
      {enabled && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className={LABEL}>from</span>
            <TimePicker value={from} onChange={setFrom} disabled={pending} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={LABEL}>to</span>
            <TimePicker value={to} onChange={setTo} disabled={pending} />
          </div>
        </div>
      )}
      <p className={HINT}>
        {enabled
          ? `nothing is sent ${formatSlot(from)}–${formatSlot(to)}, on any channel; reminders due then arrive at ${formatSlot(to)}`
          : "reminders and alerts can arrive at any time"}
      </p>
      {dirty && (
        <BracketButton onClick={save} disabled={pending} className="self-start">
          {pending ? "saving..." : "save"}
        </BracketButton>
      )}
      {message && (!message.ok || !dirty) && (
        <p
          role="status"
          className={`font-mono text-[11px] ${message.ok ? "text-muted-foreground" : "text-destructive"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
