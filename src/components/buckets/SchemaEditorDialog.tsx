"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

interface SchemaEditorDialogProps {
  open: boolean;
  bucket: BucketRow;
  onClose: () => void;
}

export function SchemaEditorDialog({ open, bucket, onClose }: SchemaEditorDialogProps) {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [error, setError] = useState("");
  const [validationErr, setValidationErr] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollToFirst = useScrollToFirst(scrollBodyRef);

  useEffect(() => {
    if (!open) return;
    const s = parseSavedSchema(bucket.fieldSchema);
    const id = setTimeout(() => {
      setFields(s.fields);
      setError("");
      setValidationErr(null);
    }, 0);
    return () => clearTimeout(id);
  }, [open, bucket.id, bucket.fieldSchema]);

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
