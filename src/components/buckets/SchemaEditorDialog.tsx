"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BracketButton } from "@/components/ui/BracketButton";
import { updateBucketSchemaAction } from "@/app/(app)/actions";
import type { FieldDef, StatusDef, BucketSchema } from "@/types/rules";
import { STATUS_COLORS } from "./constants";
import type { buckets } from "@/lib/db/schema";
import { useScrollToFirst } from "@/hooks/useScrollToFirst";
import { FieldsSection, StatusesSection, NotificationsSection } from "./SchemaEditorSections";

type BucketRow = typeof buckets.$inferSelect;

const BLANK_FIELD: FieldDef = { key: "", label: "", type: "text" };
const BLANK_STATUS: StatusDef = { name: "", color: STATUS_COLORS[3] };

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
  const [validationErr, setValidationErr] = useState<{
    type: "field" | "status";
    idx: number;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollToFirst = useScrollToFirst(scrollBodyRef);

  useEffect(() => {
    if (!open) return;
    const s = parseSavedSchema(bucket.fieldSchema);
    const id = setTimeout(() => {
      setFields(s.fields);
      setStatuses(s.statuses);
      setNotifyOnArrival(s.notifyOnArrival ?? false);
      setNotifyWhenOverdue(s.notifyWhenOverdue ?? false);
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
        setValidationErr({ type: "field", idx: i });
        scrollToFirst(`[data-field-idx="${i}"]`);
        return;
      }
    }
    for (let i = 0; i < statuses.length; i++) {
      if (!statuses[i].name.trim()) {
        setValidationErr({ type: "status", idx: i });
        scrollToFirst(`[data-status-idx="${i}"]`);
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
    if (validationErr?.type === "field" && validationErr.idx === i) setValidationErr(null);
  }

  function updateStatus(i: number, patch: Partial<StatusDef>) {
    setStatuses((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
    if (validationErr?.type === "status" && validationErr.idx === i) setValidationErr(null);
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

              <div
                ref={scrollBodyRef}
                className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-5"
              >
                <FieldsSection
                  fields={fields}
                  errorIdx={validationErr?.type === "field" ? validationErr.idx : undefined}
                  onAdd={() => setFields((p) => [...p, { ...BLANK_FIELD }])}
                  onRemove={(i) => setFields((p) => p.filter((_, idx) => idx !== i))}
                  onUpdate={updateField}
                  disabled={pending}
                />
                <StatusesSection
                  statuses={statuses}
                  errorIdx={validationErr?.type === "status" ? validationErr.idx : undefined}
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
