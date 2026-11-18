import type { FieldDef } from "@/types/rules";
import { DoneButton } from "@/components/ui/DoneButton";
import { LABEL } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
import { AUTO_CLOSE_FIELD_TYPES } from "./constants";
import { FieldInput } from "./ItemFieldsForm";

type ItemFieldChipPanelProps = {
  field: FieldDef;
  value: unknown;
  invalid: boolean;
  onChange: (value: unknown) => void;
  onDone: () => void;
};

export function ItemFieldChipPanel({
  field,
  value,
  invalid,
  onChange,
  onDone,
}: ItemFieldChipPanelProps) {
  const autoClose = AUTO_CLOSE_FIELD_TYPES.includes(field.type);

  return (
    <div
      className="flex flex-col gap-2"
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
        if (!(e.target instanceof HTMLInputElement)) return;
        e.preventDefault();
        onDone();
      }}
    >
      <label className={cn(LABEL, invalid && "text-destructive")}>
        {field.label}
        {field.validation?.required && (
          <span aria-hidden className="text-destructive ml-0.5 after:content-['*']" />
        )}
        {invalid && " is required"}
      </label>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <FieldInput
            field={field}
            value={value}
            onChange={(next) => {
              onChange(next);
              if (autoClose) onDone();
            }}
          />
        </div>
        {!autoClose && <DoneButton onClick={onDone} />}
      </div>
    </div>
  );
}
