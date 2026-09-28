import { useRef, useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEM_H = 24;
const HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"] as const;
const MINUTES: readonly string[] = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const AMPMS = ["am", "pm"] as const;

export type Ampm = "am" | "pm";

type ColumnProps<T extends string> = {
  items: readonly T[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
  width: number;
  normalize?: (raw: string) => T | null;
};

function ScrollColumn<T extends string>({
  items,
  value,
  onChange,
  disabled,
  width,
  normalize,
}: ColumnProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const holdDelayRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const userScrollingRef = useRef(false);
  const jumpingRef = useRef(false);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const editingRef = useRef(false);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const isEditValid = normalize ? normalize(editValue.trim()) !== null : true;

  function resolvedIdx(v: T): number {
    const idx = items.indexOf(v);
    return idx >= 0 ? idx : 0;
  }

  useEffect(() => {
    if (userScrollingRef.current || editingRef.current) return;
    const el = ref.current;
    if (!el) return;
    jumpingRef.current = true;
    el.scrollTop = resolvedIdx(value) * ITEM_H;
    requestAnimationFrame(() => {
      jumpingRef.current = false;
    });
  }, [value, items]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(holdDelayRef.current);
      clearInterval(holdRef.current);
    };
  }, []);

  function startHold(dir: 1 | -1) {
    step(dir);
    holdDelayRef.current = setTimeout(() => {
      holdRef.current = setInterval(() => step(dir), 80);
    }, 350);
  }

  function stopHold() {
    clearTimeout(holdDelayRef.current);
    clearInterval(holdRef.current);
  }

  function handleScroll() {
    if (jumpingRef.current) return;
    if (editingRef.current) {
      editingRef.current = false;
      setEditing(false);
    }
    userScrollingRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      userScrollingRef.current = false;
      const el = ref.current;
      if (!el) return;

      const idx = Math.round(el.scrollTop / ITEM_H);
      const clampedIdx = Math.max(0, Math.min(idx, items.length - 1));
      el.scrollTo({ top: clampedIdx * ITEM_H, behavior: "smooth" });

      const snapped = items[clampedIdx];
      if (snapped !== undefined && snapped !== valueRef.current) {
        onChangeRef.current(snapped);
      }
    }, 120);
  }

  function commitEdit() {
    editingRef.current = false;
    setEditing(false);
    if (!normalize) return;
    const result = normalize(editValue.trim());
    if (result !== null && result !== value) onChange(result);
  }

  function step(dir: 1 | -1) {
    const idx = resolvedIdx(valueRef.current);
    const next = Math.max(0, Math.min(idx + dir, items.length - 1));
    const el = ref.current;
    if (el) el.scrollTo({ top: next * ITEM_H, behavior: "smooth" });
    const nextItem = items[next];
    if (nextItem !== undefined && nextItem !== valueRef.current) onChange(nextItem);
  }

  function handleItemClick(item: T, idx: number) {
    if (editing) return;
    const el = ref.current;
    if (!el) return;
    if (item === value && normalize) {
      setEditValue(item);
      editingRef.current = true;
      setEditing(true);
      return;
    }
    el.scrollTo({ top: idx * ITEM_H, behavior: "smooth" });
    onChange(item);
  }

  return (
    <div className="flex flex-col items-center gap-0.5" style={{ width }}>
      <button
        disabled={disabled}
        onPointerDown={() => startHold(-1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        className="text-muted-foreground hover:text-foreground inline-flex items-center font-mono text-xs transition-colors disabled:opacity-25"
        style={{ touchAction: "none" }}
      >
        <span className="opacity-50">[</span>
        <ChevronUp size={10} strokeWidth={2} />
        <span className="opacity-50">]</span>
      </button>

      <div className="relative overflow-hidden" style={{ width, height: ITEM_H * 3 }}>
        <div
          className="border-border/60 pointer-events-none absolute inset-x-0 z-10 border-y"
          style={{ top: ITEM_H, height: ITEM_H }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10"
          style={{
            height: ITEM_H,
            background: "linear-gradient(to bottom, var(--background) 30%, transparent)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10"
          style={{
            height: ITEM_H,
            background: "linear-gradient(to top, var(--background) 30%, transparent)",
          }}
        />

        <div
          ref={ref}
          onScroll={handleScroll}
          className={cn(
            "overflow-y-scroll [&::-webkit-scrollbar]:hidden",
            disabled && "pointer-events-none opacity-40"
          )}
          style={{
            height: ITEM_H * 3,
            scrollSnapType: "y mandatory",
            scrollbarWidth: "none",
            paddingTop: ITEM_H,
            paddingBottom: ITEM_H,
            touchAction: "pan-y",
          }}
        >
          {items.map((item, idx) => {
            const isSelected = item === value;
            const isEditingThis = isSelected && editing;

            return (
              <div
                key={idx}
                onClick={() => handleItemClick(item, idx)}
                className={cn(
                  "flex items-center justify-center font-mono text-xs transition-opacity",
                  isSelected ? "text-foreground opacity-100" : "text-muted-foreground opacity-40",
                  "cursor-pointer select-none"
                )}
                style={{ height: ITEM_H, scrollSnapAlign: "center" }}
              >
                {isEditingThis ? (
                  <input
                    autoFocus
                    value={editValue}
                    maxLength={2}
                    onChange={(e) => setEditValue(e.target.value.replace(/[^0-9a-zA-Z]/g, ""))}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEdit();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        editingRef.current = false;
                        setEditing(false);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "w-full bg-transparent text-center font-mono text-xs transition-colors outline-none",
                      editValue.length > 0 && !isEditValid ? "text-destructive" : "text-foreground"
                    )}
                    style={{ caretColor: "var(--foreground)" }}
                  />
                ) : (
                  item
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        disabled={disabled}
        onPointerDown={() => startHold(1)}
        onPointerUp={stopHold}
        onPointerLeave={stopHold}
        onPointerCancel={stopHold}
        className="text-muted-foreground hover:text-foreground inline-flex items-center font-mono text-xs transition-colors disabled:opacity-25"
        style={{ touchAction: "none" }}
      >
        <span className="opacity-50">[</span>
        <ChevronDown size={10} strokeWidth={2} />
        <span className="opacity-50">]</span>
      </button>
    </div>
  );
}

function normalizeHour(raw: string): (typeof HOURS)[number] | null {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 12) return null;
  return String(n) as (typeof HOURS)[number];
}

function normalizeMinute(raw: string): string | null {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 59) return null;
  return String(n).padStart(2, "0");
}

function normalizeAmpm(raw: string): Ampm | null {
  const lower = raw.toLowerCase().trim();
  if (lower === "am" || lower === "a") return "am";
  if (lower === "pm" || lower === "p") return "pm";
  return null;
}

type TimeScrollPickerProps = {
  hour: string;
  min: string;
  ampm: Ampm;
  onHourChange: (h: string) => void;
  onMinChange: (m: string) => void;
  onAmpmChange: (a: Ampm) => void;
  disabled?: boolean;
};

export function TimeScrollPicker({
  hour,
  min,
  ampm,
  onHourChange,
  onMinChange,
  onAmpmChange,
  disabled,
}: TimeScrollPickerProps) {
  const parsedHour = parseInt(hour, 10);
  const normalizedHour = (
    Number.isFinite(parsedHour) && parsedHour >= 1 && parsedHour <= 12 ? String(parsedHour) : "9"
  ) as (typeof HOURS)[number];

  const parsedMin = parseInt(min, 10);
  const normalizedMin =
    Number.isFinite(parsedMin) && parsedMin >= 0 && parsedMin <= 59
      ? String(parsedMin).padStart(2, "0")
      : "00";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <ScrollColumn
          items={HOURS}
          value={normalizedHour}
          onChange={onHourChange}
          disabled={disabled}
          width={36}
          normalize={normalizeHour}
        />
        <span className="text-muted-foreground font-mono text-xs">:</span>
        <ScrollColumn
          items={MINUTES}
          value={normalizedMin}
          onChange={onMinChange}
          disabled={disabled}
          width={36}
          normalize={normalizeMinute}
        />
        <ScrollColumn
          items={AMPMS}
          value={ampm}
          onChange={onAmpmChange}
          disabled={disabled}
          width={32}
          normalize={normalizeAmpm}
        />
      </div>
      <p className="text-muted-foreground/50 font-mono text-[9px]">
        scroll, tap or arrows · click selected to type
      </p>
    </div>
  );
}
