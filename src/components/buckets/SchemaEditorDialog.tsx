"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { Toggle } from "@/components/ui/Toggle";
import { OptionButton } from "@/components/ui/OptionButton";
import { OptionGroup } from "@/components/ui/OptionGroup";
import { updateBucketSchemaAction } from "@/app/(app)/actions";
import type { FieldDef, StatusDef, BucketSchema } from "@/types/rules";
import { FIELD_TYPES } from "@/types/rules";
import { STATUS_COLORS, CURRENCY_OPTIONS } from "./constants";
import type { buckets } from "@/lib/db/schema";

type BucketRow = typeof buckets.$inferSelect;

const LABEL = "text-muted-foreground font-mono text-[10px]";
const HINT = "text-muted-foreground/50 font-mono text-[9px] leading-tight";
const INPUT =
  "border-b border-border bg-transparent py-1 font-mono text-xs outline-none placeholder:text-muted-foreground/40 focus:border-foreground disabled:opacity-50";

const BLANK_FIELD: FieldDef = { key: "", label: "", type: "text" };
const BLANK_STATUS: StatusDef = { name: "", color: STATUS_COLORS[3] };
const FIELD_TYPE_OPTIONS = FIELD_TYPES.map((t) => ({ value: t, label: t }));

function parseSavedSchema(raw: unknown): BucketSchema {
  const empty: BucketSchema = { fields: [], statuses: [] };
  if (!raw) return empty;
  try {
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty;
    const obj = parsed as Record<string, unknown>;
    return {
      fields: Array.isArray(obj.fields) ? (obj.fields as FieldDef[]) : [],
      statuses: Array.isArray(obj.statuses) ? (obj.statuses as StatusDef[]) : [],
      notifyOnArrival: obj.notifyOnArrival === true,
      notifyWhenOverdue: obj.notifyWhenOverdue === true,
    };
  } catch {
    return empty;
  }
}

interface SchemaEditorDialogProps {
  open: boolean;
  bucket: BucketRow;
  onClose: () => void;
}

export function SchemaEditorDialog({ open, bucket, onClose }: SchemaEditorDialogProps) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [statuses, setStatuses] = useState<StatusDef[]>([]);
  const [notifyOnArrival, setNotifyOnArrival] = useState(false);
  const [notifyWhenOverdue, setNotifyWhenOverdue] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const s = parseSavedSchema(bucket.fieldSchema);
    const id = setTimeout(() => {
      setFields(s.fields);
      setStatuses(s.statuses);
      setNotifyOnArrival(s.notifyOnArrival ?? false);
      setNotifyWhenOverdue(s.notifyWhenOverdue ?? false);
      setError("");
    }, 0);
    return () => clearTimeout(id);
  }, [open, bucket.id, bucket.fieldSchema]);

  function handleSave() {
    setError("");
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].label.trim()) {
        setError(`Field ${i + 1} is missing a name`);
        return;
      }
    }
    for (let i = 0; i < statuses.length; i++) {
      if (!statuses[i].name.trim()) {
        setError(`Status ${i + 1} is missing a name`);
        return;
      }
    }
    startTransition(async () => {
      const result = await updateBucketSchemaAction(bucket.id, {
        fields,
        statuses,
        notifyOnArrival: notifyOnArrival || undefined,
        notifyWhenOverdue: notifyWhenOverdue || undefined,
      });
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  function updateField(i: number, patch: Partial<FieldDef>) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function updateStatus(i: number, patch: Partial<StatusDef>) {
    setStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function setDefaultStatus(i: number) {
    setStatuses((prev) =>
      prev.map((s, idx) => ({ ...s, isDefault: idx === i ? true : undefined }))
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="schema-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-[65] bg-black"
            onClick={onClose}
          />
          <motion.div
            key="schema-dialog"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed top-[4%] left-1/2 z-[70] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2"
            style={{ boxShadow: "5px 5px 0 var(--border)" }}
          >
            <div className="border-border bg-background flex max-h-[92vh] flex-col overflow-hidden border-2">
              <div className="bg-foreground text-background flex shrink-0 items-center justify-between gap-2 px-3 py-1.5">
                <span className="font-pixel min-w-0 truncate text-xs">schema [{bucket.name}]</span>
                <BracketButton variant="inverted" onClick={onClose}>
                  x
                </BracketButton>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-5">
                <FieldsSection
                  fields={fields}
                  onAdd={() => setFields((p) => [...p, { ...BLANK_FIELD }])}
                  onRemove={(i) => setFields((p) => p.filter((_, idx) => idx !== i))}
                  onUpdate={updateField}
                  disabled={pending}
                />
                <StatusesSection
                  statuses={statuses}
                  onAdd={() => setStatuses((p) => [...p, { ...BLANK_STATUS }])}
                  onRemove={(i) => setStatuses((p) => p.filter((_, idx) => idx !== i))}
                  onUpdate={updateStatus}
                  onSetDefault={setDefaultStatus}
                  disabled={pending}
                />
                <NotificationsSection
                  notifyOnArrival={notifyOnArrival}
                  notifyWhenOverdue={notifyWhenOverdue}
                  onArrivalChange={setNotifyOnArrival}
                  onOverdueChange={setNotifyWhenOverdue}
                  disabled={pending}
                />
                {error && <p className="text-destructive font-mono text-[10px]">{error}</p>}
              </div>

              <div className="border-border flex shrink-0 items-center justify-end border-t px-3 py-2.5">
                <BracketButton onClick={handleSave} disabled={pending}>
                  save schema
                </BracketButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function FieldRow({
  field,
  onUpdate,
  onRemove,
  disabled,
}: {
  field: FieldDef;
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
    <div className="border-border flex flex-col gap-3 border p-3">
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

      <div className="flex flex-col gap-1.5">
        <span className={HINT}>type</span>
        <OptionGroup
          options={[...FIELD_TYPE_OPTIONS]}
          value={field.type}
          onChange={(v) => onUpdate({ type: v })}
          disabled={disabled}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={HINT}>modifiers</span>
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
          <span className={HINT}>options — type values separated by commas</span>
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
          <span className={HINT}>currency</span>
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

function FieldsSection({
  fields,
  onAdd,
  onRemove,
  onUpdate,
  disabled,
}: {
  fields: FieldDef[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, patch: Partial<FieldDef>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <p className={LABEL}>fields</p>
          <p className={HINT}>
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
        <p className={HINT}>no fields defined — items only have a title and deadline</p>
      )}
      {fields.map((f, i) => (
        <FieldRow
          key={i}
          field={f}
          onUpdate={(patch) => onUpdate(i, patch)}
          onRemove={() => onRemove(i)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

function StatusesSection({
  statuses,
  onAdd,
  onRemove,
  onUpdate,
  onSetDefault,
  disabled,
}: {
  statuses: StatusDef[];
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
          <p className={LABEL}>statuses</p>
          <p className={HINT}>
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
        <p className={HINT}>no custom statuses — using built-in active and completed</p>
      )}
      {statuses.map((s, i) => (
        <div key={i} className="border-border flex flex-col gap-2.5 border p-3">
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

function NotificationsSection({
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
      <p className={LABEL}>notifications</p>
      <div className="flex flex-col gap-1.5">
        <p className={LABEL}>notify on arrival</p>
        <p className={HINT}>send a notification every time a new item arrives via webhook</p>
        <Toggle value={notifyOnArrival} onChange={onArrivalChange} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className={LABEL}>notify when overdue</p>
        <p className={HINT}>
          send a one-time notification when an item passes its deadline without being completed
        </p>
        <Toggle value={notifyWhenOverdue} onChange={onOverdueChange} disabled={disabled} />
      </div>
    </div>
  );
}
