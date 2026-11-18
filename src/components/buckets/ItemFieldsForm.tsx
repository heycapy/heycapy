import { DatePicker } from "@/components/ui/DatePicker";
import { OptionButton } from "@/components/ui/OptionButton";
import type { FieldDef } from "@/types/rules";
import { FIELD_INPUT } from "./constants";
import {
  CurrencyFieldInput,
  DatetimeFieldInput,
  NumberFieldInput,
  UrlFieldInput,
} from "./ItemFieldInputs";
import { IconButton } from "@/components/ui/IconButton";

export function FieldInput({
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
          <OptionButton
            soft
            active={value === true}
            onClick={() => onChange(true)}
            disabled={disabled}
          >
            Yes
          </OptionButton>
          <OptionButton
            soft
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
            <IconButton
              icon="close"
              tone="destructive"
              onClick={() => onChange(undefined)}
              aria-label="clear date"
            />
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
              soft
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
              soft
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
