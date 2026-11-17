import type { FieldDef } from "@/types/rules";
import { DoneButton } from "@/components/ui/DoneButton";
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
      {invalid && <p className="text-destructive font-ui text-2xs">{field.label} is required</p>}
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
