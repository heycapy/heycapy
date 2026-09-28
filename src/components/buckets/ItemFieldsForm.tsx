import { X } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { OptionButton } from "@/components/ui/OptionButton";
import type { FieldDef } from "@/types/rules";
import { cn } from "@/lib/utils";
import { FIELD_INPUT, FIELD_LABEL } from "./constants";
import {
  CurrencyFieldInput,
  DatetimeFieldInput,
  NumberFieldInput,
  UrlFieldInput,
} from "./ItemFieldInputs";

type ItemFieldsFormProps = {
  fields: FieldDef[];
  values: Record<string, unknown>;
  disabled?: boolean;
  showErrors?: boolean;
  onChange: (values: Record<string, unknown>) => void;
};

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
            <label className={cn(FIELD_LABEL, "block break-words", hasError && "text-destructive")}>
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
          className={FIELD_INPUT}
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
          className={`${FIELD_INPUT} resize-none`}
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
              className="max-w-[200px] truncate"
              title={opt}
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
              className="max-w-[200px] truncate"
              title={opt}
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
