import { useState } from "react";
import { cn } from "@/lib/utils";

type TimePickerProps = {
  value: string; // stored as "HH:MM"
  onChange: (value: string) => void;
  disabled?: boolean;
};

function parseInput(str: string): string | null {
  const s = str.trim().toLowerCase();
  if (!s) return "";

  const withColon = s.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (withColon) {
    let h = parseInt(withColon[1], 10);
    const m = parseInt(withColon[2], 10);
    const mer = withColon[3];
    if (h > 23 || m > 59) return null;
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  const withMer = s.match(/^(\d{1,2})\s*(am|pm)$/);
  if (withMer) {
    let h = parseInt(withMer[1], 10);
    const mer = withMer[2];
    if (h > 12) return null;
    if (mer === "pm" && h < 12) h += 12;
    if (mer === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:00`;
  }

  if (/^\d{4}$/.test(s)) {
    const h = parseInt(s.slice(0, 2), 10);
    const m = parseInt(s.slice(2), 10);
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  if (/^\d{1,2}$/.test(s)) {
    const h = parseInt(s, 10);
    if (h > 23) return null;
    return `${String(h).padStart(2, "0")}:00`;
  }

  return null;
}

function toDisplay(value: string): string {
  const [hStr, mStr] = value.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const mer = h >= 12 ? "pm" : "am";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${dh} ${mer}` : `${dh}:${String(m).padStart(2, "0")} ${mer}`;
}

export function TimePicker({ value, onChange, disabled }: TimePickerProps) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [invalid, setInvalid] = useState(false);

  function onFocus() {
    setEditing(true);
    setDraft(value ? toDisplay(value) : "");
    setInvalid(false);
  }

  function onBlur() {
    setEditing(false);
    if (!draft.trim()) {
      onChange("");
      setInvalid(false);
      return;
    }
    const parsed = parseInput(draft);
    if (parsed === null) {
      setInvalid(true);
    } else {
      setInvalid(false);
      onChange(parsed);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        value={editing ? draft : value ? toDisplay(value) : ""}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="e.g. 9 am, 2:30 pm, 14:00"
        disabled={disabled}
        className={cn(
          "placeholder:text-muted-foreground/50 w-full border-b bg-transparent py-1.5 font-mono text-xs outline-none disabled:opacity-50",
          invalid ? "border-destructive text-destructive" : "border-border focus:border-foreground"
        )}
      />
      {invalid && (
        <span className="text-destructive font-mono text-[10px]">unrecognized format</span>
      )}
    </div>
  );
}
