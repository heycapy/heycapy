"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { OptionButton } from "@/components/ui/OptionButton";
import { TimeScrollPicker, type Ampm } from "@/components/ui/TimeScrollPicker";
import type { FieldDef } from "@/types/rules";
import { cn } from "@/lib/utils";

const LABEL = "text-muted-foreground font-mono text-[10px]";
const INPUT =
  "border-b border-border w-full bg-transparent py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/50 focus:border-foreground disabled:opacity-50";

interface ItemFieldsFormProps {
  fields: FieldDef[];
  values: Record<string, unknown>;
  disabled?: boolean;
  showErrors?: boolean;
  onChange: (values: Record<string, unknown>) => void;
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && !value.trim()) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export function ItemFieldsForm({
  fields,
  values,
  disabled,
  showErrors,
  onChange,
}: ItemFieldsFormProps) {
  if (fields.length === 0) return null;

  function set(key: string, value: unknown) {
    onChange({ ...values, [key]: value });
  }

  return (
    <>
      {fields.map((field, idx) => {
        const isRequired = !!field.validation?.required;
        const hasError = showErrors && isRequired && isEmpty(values[field.key]);
        return (
          <div
            key={field.key}
            data-field-key={field.key}
            className="border-border flex flex-col gap-1.5 border-b p-3 last:border-b-0"
          >
            <label className={cn(LABEL, "block break-words", hasError && "text-destructive")}>
              <span className="mr-1">{idx + 1}.</span>
              {field.icon ? `${field.icon} ` : ""}
              {field.label}
              {isRequired && <span className="text-destructive ml-0.5">*</span>}
            </label>
            <FieldInput
              field={field}
              value={values[field.key]}
              disabled={disabled}
              onChange={(v) => set(field.key, v)}
            />
            {hasError && (
              <p className="text-destructive font-mono text-[9px]">{field.label} is required</p>
            )}
          </div>
        );
      })}
    </>
  );
}

function FieldInput({
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
  switch (field.type) {
    case "text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
          disabled={disabled}
          maxLength={field.validation?.maxLength}
          className={INPUT}
        />
      );

    case "textarea":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.label}
          disabled={disabled}
          rows={3}
          maxLength={field.validation?.maxLength}
          className={`${INPUT} resize-none`}
        />
      );

    case "number":
      return (
        <NumberFieldInput field={field} value={value} disabled={disabled} onChange={onChange} />
      );

    case "currency":
      return (
        <CurrencyFieldInput field={field} value={value} disabled={disabled} onChange={onChange} />
      );

    case "boolean":
      return (
        <div className="flex gap-1">
          <OptionButton active={value === true} onClick={() => onChange(true)} disabled={disabled}>
            Yes
          </OptionButton>
          <OptionButton
            active={value === false}
            onClick={() => onChange(false)}
            disabled={disabled}
          >
            No
          </OptionButton>
        </div>
      );

    case "date": {
      const dateVal = typeof value === "string" ? value : "";
      return (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <DatePicker value={dateVal} onChange={onChange} disabled={disabled} />
          </div>
          {dateVal && !disabled && (
            <button
              onClick={() => onChange(undefined)}
              className="text-muted-foreground hover:text-destructive shrink-0 transition-colors"
            >
              <X size={11} />
            </button>
          )}
        </div>
      );
    }

    case "datetime":
      return <DatetimeFieldInput value={value} disabled={disabled} onChange={onChange} />;

    case "url":
      return <UrlFieldInput value={value} disabled={disabled} onChange={onChange} />;

    case "select": {
      const opts = field.options ?? [];
      return (
        <div className="flex flex-wrap gap-1">
          {opts.map((opt) => (
            <OptionButton
              key={opt}
              active={value === opt}
              onClick={() => onChange(value === opt ? undefined : opt)}
              disabled={disabled}
            >
              {opt}
            </OptionButton>
          ))}
        </div>
      );
    }

    case "multiselect": {
      const opts = field.options ?? [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {opts.map((opt) => (
            <OptionButton
              key={opt}
              active={selected.includes(opt)}
              onClick={() => {
                const next = selected.includes(opt)
                  ? selected.filter((v) => v !== opt)
                  : [...selected, opt];
                onChange(next.length > 0 ? next : undefined);
              }}
              disabled={disabled}
            >
              {opt}
            </OptionButton>
          ))}
        </div>
      );
    }

    default:
      return null;
  }
}

function NumberFieldInput({
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
        className={INPUT}
      />
      {errorMsg && <p className="text-destructive font-mono text-[9px]">{errorMsg}</p>}
    </div>
  );
}

function CurrencyFieldInput({
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
          className={`${INPUT} flex-1`}
        />
      </div>
      {isInvalid && <p className="text-destructive font-mono text-[9px]">invalid amount</p>}
    </div>
  );
}

function DatetimeFieldInput({
  value,
  disabled,
  onChange,
}: {
  value: unknown;
  disabled?: boolean;
  onChange: (v: unknown) => void;
}) {
  function toH12(h24: number): { hour: string; ampm: Ampm } {
    const isPm = h24 >= 12;
    const h = isPm ? (h24 === 12 ? 12 : h24 - 12) : h24 === 0 ? 12 : h24;
    return { hour: String(h), ampm: isPm ? "pm" : "am" };
  }

  function toH24(h12: number, ampm: Ampm): number {
    if (ampm === "am") return h12 === 12 ? 0 : h12;
    return h12 === 12 ? 12 : h12 + 12;
  }

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

function UrlFieldInput({
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
        className={INPUT}
      />
      {hasError && (
        <p className="text-destructive font-mono text-[9px]">must be a valid URL (https://...)</p>
      )}
    </div>
  );
}
