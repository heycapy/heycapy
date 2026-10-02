import type { ReactNode } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { SETTINGS_API_KEY_MAX_LENGTH } from "@/constants";
import { CharCount } from "./CharCount";
import { INPUT, LABEL } from "./settings-constants";

type KeyFieldProps = {
  label: ReactNode;
  inputLabel: string;
  saved: boolean;
  keyEnding: string | null;
  editing: boolean;
  value: string;
  onChange: (value: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  disabled: boolean;
};

export function KeyField({
  label,
  inputLabel,
  saved,
  keyEnding,
  editing,
  value,
  onChange,
  onEdit,
  onCancel,
  disabled,
}: KeyFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={LABEL}>{label}</span>
      {saved && !editing ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs">
            saved · {keyEnding ? `••••${keyEnding}` : "••••••••"}
          </span>
          <BracketButton type="button" onClick={onEdit} disabled={disabled}>
            edit
          </BracketButton>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="sk-..."
              aria-label={inputLabel}
              autoComplete="new-password"
              maxLength={SETTINGS_API_KEY_MAX_LENGTH}
              disabled={disabled}
              autoFocus={editing}
              className={INPUT}
            />
            {saved && (
              <BracketButton type="button" onClick={onCancel} disabled={disabled}>
                cancel
              </BracketButton>
            )}
          </div>
          <CharCount length={value.length} max={SETTINGS_API_KEY_MAX_LENGTH} />
        </>
      )}
    </div>
  );
}
