import { ACCENT_BUTTONS } from "@/components/layout/settings-constants";
import { cn } from "@/lib/utils";
import { useRef, useState, useTransition } from "react";
import { Modal, ModalHeader } from "@/components/ui/Modal";
import { BracketButton } from "@/components/ui/BracketButton";
import { updateBucketSchemaAction } from "@/app/(app)/actions";
import type { FieldDef, BucketSchema } from "@/types/rules";
import type { buckets } from "@/lib/db/schema";
import { useScrollToFirst } from "@/hooks/useScrollToFirst";
import { FieldsSection } from "./SchemaEditorSections";

type BucketRow = typeof buckets.$inferSelect;

const BLANK_FIELD: FieldDef = { key: "", label: "", type: "text", showInRow: true };

function parseSavedSchema(raw: unknown): BucketSchema {
  const empty: BucketSchema = { fields: [] };
  if (!raw) return empty;
  try {
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return empty;
    const obj = parsed as Record<string, unknown>;
    return {
      fields: Array.isArray(obj.fields) ? (obj.fields as FieldDef[]) : [],
      notifyOnArrival: obj.notifyOnArrival === true,
      notifyWhenOverdue: obj.notifyWhenOverdue === true,
      overdueRepeatHours:
        typeof obj.overdueRepeatHours === "number" ? obj.overdueRepeatHours : undefined,
    };
  } catch {
    return empty;
  }
}

type SchemaEditorDialogProps = {
  open: boolean;
  bucket: BucketRow;
  onClose: () => void;
};

export function SchemaEditorDialog({ open, bucket, onClose }: SchemaEditorDialogProps) {
  return (
    <Modal open={open} onClose={onClose} layer="raised" className="top-[4%] max-w-xl sm:top-[4%]">
      <SchemaEditorForm bucket={bucket} onClose={onClose} />
    </Modal>
  );
}

// Mounted fresh on every open, so edits are never overwritten by a background refresh
function SchemaEditorForm({ bucket, onClose }: Omit<SchemaEditorDialogProps, "open">) {
  const [fields, setFields] = useState<FieldDef[]>(
    () => parseSavedSchema(bucket.fieldSchema).fields
  );
  const [error, setError] = useState("");
  const [validationErr, setValidationErr] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollToFirst = useScrollToFirst(scrollBodyRef);

  function handleSave() {
    setError("");
    setValidationErr(null);
    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].label.trim()) {
        setValidationErr(i);
        scrollToFirst(`[data-field-idx="${i}"]`);
        return;
      }
    }
    startTransition(async () => {
      const result = await updateBucketSchemaAction(bucket.id, { fields });
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  function updateField(i: number, patch: Partial<FieldDef>) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
    if (validationErr === i) setValidationErr(null);
  }

  return (
    <div
      className={cn(
        "border-border bg-background flex max-h-[92vh] flex-col overflow-hidden border-2",
        ACCENT_BUTTONS
      )}
    >
      <ModalHeader title={`schema [${bucket.name}]`} onClose={onClose} />

      <div
        ref={scrollBodyRef}
        className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-5"
      >
        <FieldsSection
          fields={fields}
          errorIdx={validationErr ?? undefined}
          onAdd={() => setFields((p) => [...p, { ...BLANK_FIELD }])}
          onRemove={(i) => setFields((p) => p.filter((_, idx) => idx !== i))}
          onUpdate={updateField}
          onMove={(from, to) => {
            setFields((p) => {
              const next = [...p];
              const [item] = next.splice(from, 1);
              next.splice(to, 0, item);
              return next;
            });
            setValidationErr(null);
          }}
          disabled={pending}
        />
        {error && <p className="text-destructive font-mono text-xs">{error}</p>}
      </div>

      <div className="border-border flex shrink-0 items-center justify-end border-t px-3 py-2.5">
        <BracketButton onClick={handleSave} disabled={pending}>
          save schema
        </BracketButton>
      </div>
    </div>
  );
}
