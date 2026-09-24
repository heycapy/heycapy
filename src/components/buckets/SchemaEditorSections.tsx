import { useEffect, useRef, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Toggle } from "@/components/ui/Toggle";
import { OptionButton } from "@/components/ui/OptionButton";
import { OptionGroup } from "@/components/ui/OptionGroup";
import type { FieldDef, StatusDef } from "@/types/rules";
import { FIELD_TYPES } from "@/types/rules";
import { CURRENCY_OPTIONS } from "./constants";
import { cn } from "@/lib/utils";

export const SCHEMA_LABEL = "text-muted-foreground font-mono text-[10px]";
export const SCHEMA_HINT = "text-muted-foreground/50 font-mono text-[9px] leading-tight";
const INPUT =
  "border-b border-border bg-transparent py-1 font-mono text-xs outline-none placeholder:text-muted-foreground/40 focus:border-foreground disabled:opacity-50";

const FIELD_TYPE_OPTIONS = FIELD_TYPES.map((t) => ({ value: t, label: t }));

function FieldRow({
  field,
  dataIdx,
  hasError,
  onUpdate,
  onRemove,
  disabled,
}: {
  field: FieldDef;
  dataIdx: number;
  hasError?: boolean;
  onUpdate: (patch: Partial<FieldDef>) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const [optionsText, setOptionsText] = useState(field.options?.join(", ") ?? "");
  const prevKey = useRef(field.options?.join(",") ?? "");

  useEffect(() => {
    const key = field.options?.join(",") ?? "";
    if (key !== prevKey.current) {
      prevKey.current = key;
      setOptionsText(field.options?.join(", ") ?? "");
    }
  }, [field.options]);

  return (
    <div
      className={cn(
        "border-border flex flex-col gap-3 border p-3",
        hasError && "border-destructive"
      )}
      data-field-idx={dataIdx}
    >
      <div className="flex items-center gap-2">
        <input
          className={`${INPUT} flex-1`}
          value={field.label}
          onChange={(e) =>
            onUpdate({
              label: e.target.value,
              key: e.target.value
                .toLowerCase()
                .replace(/\s+/g, "_")
                .replace(/[^a-z0-9_]/g, ""),
            })
          }
          placeholder="field name"
          disabled={disabled}
        />
        <button
          onClick={onRemove}
          disabled={disabled}
          className="text-muted-foreground hover:text-destructive shrink-0 transition-colors disabled:opacity-40"
        >
          <Trash2 size={11} />
        </button>
      </div>
      {hasError && <p className="text-destructive font-mono text-[9px]">field name is required</p>}

      <div className="flex flex-col gap-1.5">
        <span className={SCHEMA_HINT}>type</span>
        <OptionGroup
          options={[...FIELD_TYPE_OPTIONS]}
          value={field.type}
          onChange={(v) => onUpdate({ type: v })}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={SCHEMA_HINT}>modifiers</span>
        <div className="flex flex-wrap gap-1.5">
          <OptionButton
            active={!!field.showInRow}
            onClick={() => onUpdate({ showInRow: !field.showInRow || undefined })}
            disabled={disabled}
          >
            show in list
          </OptionButton>
          <OptionButton
            active={!!field.validation?.required}
            onClick={() =>
              onUpdate({
                validation: {
                  ...field.validation,
                  required: !field.validation?.required || undefined,
                },
              })
            }
            disabled={disabled}
          >
            required
          </OptionButton>
        </div>
      </div>

      {(field.type === "select" || field.type === "multiselect") && (
        <div className="flex flex-col gap-1.5">
          <span className={SCHEMA_HINT}>options — type values separated by commas</span>
          <input
            className={`${INPUT} w-full`}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            onBlur={() =>
              onUpdate({
                options: optionsText
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="e.g. low, medium, high"
            disabled={disabled}
          />
        </div>
      )}

      {field.type === "currency" && (
        <div className="flex items-center gap-2">
          <span className={SCHEMA_HINT}>currency</span>
          <OptionGroup
            options={[...CURRENCY_OPTIONS]}
            value={(field.currency ?? "$") as "$" | "€" | "₹"}
            onChange={(v) => onUpdate({ currency: v })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

export function FieldsSection({
  fields,
  errorIdx,
  onAdd,
  onRemove,
  onUpdate,
  disabled,
}: {
  fields: FieldDef[];
  errorIdx?: number;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, patch: Partial<FieldDef>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className={SCHEMA_LABEL}>fields</p>
          <p className={SCHEMA_HINT}>
            extra information attached to each item — like an amount, priority, or URL
          </p>
        </div>
        <button
          onClick={onAdd}
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors disabled:opacity-40"
        >
          <Plus size={12} />
        </button>
      </div>
      {fields.length === 0 && (
        <p className={SCHEMA_HINT}>no fields defined — items only have a title and deadline</p>
      )}
      {fields.map((f, i) => (
        <FieldRow
          key={i}
          field={f}
          dataIdx={i}
          hasError={errorIdx === i}
          onUpdate={(patch) => onUpdate(i, patch)}
          onRemove={() => onRemove(i)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

export function StatusesSection({
  statuses,
  errorIdx,
  onAdd,
  onRemove,
  onUpdate,
  onSetDefault,
  disabled,
}: {
  statuses: StatusDef[];
  errorIdx?: number;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, patch: Partial<StatusDef>) => void;
  onSetDefault: (i: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className={SCHEMA_LABEL}>statuses</p>
          <p className={SCHEMA_HINT}>
            define the stages items can move through — if none, built-in active and completed are
            used
          </p>
        </div>
        <button
          onClick={onAdd}
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors disabled:opacity-40"
        >
          <Plus size={12} />
        </button>
      </div>
      {statuses.length === 0 && (
        <p className={SCHEMA_HINT}>no custom statuses — using built-in active and completed</p>
      )}
      {statuses.map((s, i) => (
        <div
          key={i}
          data-status-idx={i}
          className={cn(
            "border-border flex flex-col gap-2.5 border p-3",
            errorIdx === i && "border-destructive"
          )}
        >
          {errorIdx === i && (
            <p className="text-destructive font-mono text-[9px]">status name is required</p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={s.color}
              onChange={(e) => onUpdate(i, { color: e.target.value })}
              className="h-5 w-5 shrink-0 cursor-pointer rounded-none border-0 bg-transparent p-0 disabled:opacity-40"
              disabled={disabled}
            />
            <input
              className={`${INPUT} flex-1`}
              value={s.name}
              onChange={(e) => onUpdate(i, { name: e.target.value })}
              placeholder="status name"
              disabled={disabled}
            />
            <button
              onClick={() => onRemove(i)}
              disabled={disabled}
              className="text-muted-foreground hover:text-destructive shrink-0 transition-colors disabled:opacity-40"
            >
              <Trash2 size={11} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <OptionButton
              active={!!s.isDefault}
              onClick={() => onSetDefault(i)}
              disabled={disabled}
            >
              starting status
            </OptionButton>
            <OptionButton
              active={!!s.isCompleted}
              onClick={() => onUpdate(i, { isCompleted: !s.isCompleted || undefined })}
              disabled={disabled}
            >
              marks item complete
            </OptionButton>
            <OptionButton
              active={!!s.notifyOnReach}
              onClick={() => onUpdate(i, { notifyOnReach: !s.notifyOnReach || undefined })}
              disabled={disabled}
            >
              notify when reached
            </OptionButton>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationsSection({
  notifyOnArrival,
  notifyWhenOverdue,
  onArrivalChange,
  onOverdueChange,
  disabled,
}: {
  notifyOnArrival: boolean;
  notifyWhenOverdue: boolean;
  onArrivalChange: (v: boolean) => void;
  onOverdueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className={SCHEMA_LABEL}>notifications</p>
      <div className="flex flex-col gap-1.5">
        <p className={SCHEMA_LABEL}>notify on arrival</p>
        <p className={SCHEMA_HINT}>send a notification every time a new item arrives via webhook</p>
        <Toggle value={notifyOnArrival} onChange={onArrivalChange} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className={SCHEMA_LABEL}>notify when overdue</p>
        <p className={SCHEMA_HINT}>
          send a one-time notification when an item passes its deadline without being completed
        </p>
        <Toggle value={notifyWhenOverdue} onChange={onOverdueChange} disabled={disabled} />
      </div>
    </div>
  );
}
