import { useState } from "react";
import { X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimeScrollPicker, type Ampm } from "@/components/ui/TimeScrollPicker";
import { toH12, toH24 } from "@/lib/time";
import type { FieldDef } from "@/types/rules";
import { FIELD_INPUT } from "./constants";

export function NumberFieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  disabled?: boolean;
  onChange: (v: unknown) => void;
}) {
  const [raw, setRaw] = useState(typeof value === "number" ? String(value) : "");
  const parsed = raw === "" ? undefined : parseFloat(raw);
  const min = field.validation?.min;
  const max = field.validation?.max;

  const errorMsg =
    raw === ""
      ? null
      : parsed === undefined || isNaN(parsed)
        ? "invalid number"
        : min !== undefined && parsed < min
          ? `minimum is ${min}`
          : max !== undefined && parsed > max
            ? `maximum is ${max}`
            : null;

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          const n = parseFloat(e.target.value);
          onChange(isNaN(n) ? undefined : n);
        }}
        placeholder="0"
        disabled={disabled}
        className={FIELD_INPUT}
      />
      {errorMsg && <p className="text-destructive font-mono text-[9px]">{errorMsg}</p>}
    </div>
  );
}

export function CurrencyFieldInput({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldDef;
  value: unknown;
  disabled?: boolean;
  onChange: (v: unknown) => void;
}) {
  const [raw, setRaw] = useState(typeof value === "number" ? String(value) : "");
  const isInvalid = raw !== "" && isNaN(parseFloat(raw));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {field.currency && (
          <span className="text-muted-foreground font-mono text-xs">{field.currency}</span>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            const n = parseFloat(e.target.value);
            onChange(isNaN(n) ? undefined : n);
          }}
          placeholder="0.00"
          disabled={disabled}
          className={`${FIELD_INPUT} flex-1`}
        />
      </div>
      {isInvalid && <p className="text-destructive font-mono text-[9px]">invalid amount</p>}
    </div>
  );
}

export function DatetimeFieldInput({
  value,
  disabled,
  onChange,
}: {
  value: unknown;
  disabled?: boolean;
  onChange: (v: unknown) => void;
}) {
  const parsed = typeof value === "string" && value.includes("T") ? new Date(value) : null;
  const validParsed = parsed && !isNaN(parsed.getTime()) ? parsed : null;

  const [date, setDate] = useState(
    validParsed && typeof value === "string" ? value.slice(0, 10) : ""
  );
  const { hour: initH, ampm: initA } = validParsed
    ? toH12(validParsed.getHours())
    : { hour: "9", ampm: "am" as Ampm };
  const [hour, setHour] = useState(initH);
  const [min, setMin] = useState(
    validParsed ? String(validParsed.getMinutes()).padStart(2, "0") : "00"
  );
  const [ampm, setAmpm] = useState<Ampm>(initA);

  function emit(d: string, h: string, m: string, a: Ampm) {
    if (!d) {
      onChange(undefined);
      return;
    }
    const hNum = parseInt(h, 10);
    if (!Number.isFinite(hNum)) {
      onChange(undefined);
      return;
    }
    const local = `${d}T${String(toH24(hNum, a)).padStart(2, "0")}:${m}:00`;
    const dt = new Date(local);
    onChange(isNaN(dt.getTime()) ? undefined : dt.toISOString());
  }

  function clear() {
    setDate("");
    onChange(undefined);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <DatePicker
            value={date}
            onChange={(d) => {
              const s = d as string;
              setDate(s);
              emit(s, hour, min, ampm);
            }}
            disabled={disabled}
          />
        </div>
        {date && !disabled && (
          <button
            onClick={clear}
            className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
          >
            <X size={11} />
          </button>
        )}
      </div>
      {date && (
        <TimeScrollPicker
          hour={hour}
          min={min}
          ampm={ampm}
          onHourChange={(h) => {
            setHour(h);
            emit(date, h, min, ampm);
          }}
          onMinChange={(m) => {
            setMin(m);
            emit(date, hour, m, ampm);
          }}
          onAmpmChange={(a) => {
            setAmpm(a);
            emit(date, hour, min, a);
          }}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function isValidUrl(s: string): boolean {
  try {
    const url = new URL(s);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function UrlFieldInput({
  value,
  disabled,
  onChange,
}: {
  value: unknown;
  disabled?: boolean;
  onChange: (v: unknown) => void;
}) {
  const [touched, setTouched] = useState(false);
  const str = typeof value === "string" ? value : "";
  const hasError = touched && str !== "" && !isValidUrl(str);

  return (
    <div className="flex flex-col gap-1">
      <input
        type="text"
        value={str}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="https://"
        disabled={disabled}
        className={FIELD_INPUT}
      />
      {hasError && (
        <p className="text-destructive font-mono text-[9px]">must be a valid URL (https://...)</p>
      )}
    </div>
  );
}
