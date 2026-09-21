"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BracketButton } from "@/components/ui/BracketButton";
import { STATUS_COLORS } from "@/components/buckets/constants";
import {
  createItemStatusAction,
  updateItemStatusAction,
  deleteItemStatusAction,
  getItemStatusesAction,
} from "@/app/(app)/actions";
import { useUIStore } from "@/store/ui";
import type { UserStatus } from "@/types/status";
import { LABEL } from "./settings-constants";

const BORDER_INPUT =
  "border-b border-transparent bg-transparent py-0.5 font-mono text-xs outline-none placeholder:text-muted-foreground/40 focus:border-border disabled:opacity-50";

function ColorSwatches({ current, onChange }: { current: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {STATUS_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className="h-4 w-4 rounded-full transition-opacity hover:opacity-80"
          style={{
            backgroundColor: c,
            outline: current === c ? "2px solid var(--foreground)" : undefined,
            outlineOffset: "1px",
          }}
        />
      ))}
    </div>
  );
}

function StatusRow({
  status,
  onColorChange,
  onNameChange,
  onDelete,
}: {
  status: UserStatus;
  onColorChange: (id: number, color: string) => void;
  onNameChange: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const [draft, setDraft] = useState(status.name);

  function handleNameBlur() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== status.name) {
      onNameChange(status.id, trimmed);
    } else {
      setDraft(status.name);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => setColorOpen(!colorOpen)}
          className="h-2.5 w-2.5 shrink-0 rounded-full transition-opacity hover:opacity-70"
          style={{ backgroundColor: status.color }}
        />
        {status.isSystem ? (
          <span className="text-muted-foreground flex-1 font-mono text-xs">{status.name}</span>
        ) : (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            maxLength={30}
            className={cn(BORDER_INPUT, "flex-1")}
          />
        )}
        {status.isSystem ? (
          <span className="text-muted-foreground/40 font-mono text-[9px]">system</span>
        ) : (
          <button
            onClick={() => onDelete(status.id)}
            className="text-muted-foreground/40 hover:text-destructive transition-colors"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
      {colorOpen && (
        <div className="pl-5">
          <ColorSwatches
            current={status.color}
            onChange={(c) => {
              onColorChange(status.id, c);
              setColorOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

export function StatusesTab() {
  const statuses = useUIStore((s) => s.statuses);
  const setStatuses = useUIStore((s) => s.setStatuses);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(STATUS_COLORS[4] ?? "#3b82f6");
  const [newColorOpen, setNewColorOpen] = useState(false);
  const [error, setError] = useState("");
  const [addPending, startAdd] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  async function handleColorChange(id: number, color: string) {
    const status = statuses.find((s) => s.id === id);
    if (!status) return;
    await updateItemStatusAction(id, color);
    setStatuses(statuses.map((s) => (s.id === id ? { ...s, color } : s)));
  }

  async function handleNameChange(id: number, name: string) {
    const status = statuses.find((s) => s.id === id);
    if (!status) return;
    await updateItemStatusAction(id, status.color, name);
    setStatuses(statuses.map((s) => (s.id === id ? { ...s, name } : s)));
  }

  async function handleDelete(id: number) {
    await deleteItemStatusAction(id);
    setStatuses(statuses.filter((s) => s.id !== id));
  }

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed || addPending) return;
    setError("");
    startAdd(async () => {
      const result = await createItemStatusAction(trimmed, newColor);
      if (result.ok) {
        const fetched = await getItemStatusesAction();
        if (fetched.ok) setStatuses(fetched.statuses);
        setNewName("");
        setNewColorOpen(false);
        nameRef.current?.focus();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <label className={LABEL}>statuses</label>
        {statuses.length === 0 ? (
          <p className="text-muted-foreground font-mono text-[10px]">loading…</p>
        ) : (
          statuses.map((s) => (
            <StatusRow
              key={s.id}
              status={s}
              onColorChange={handleColorChange}
              onNameChange={handleNameChange}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
      <div className="border-border flex flex-col gap-2 border-t pt-3">
        <label className={LABEL}>add status</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNewColorOpen(!newColorOpen)}
            className="h-2.5 w-2.5 shrink-0 rounded-full transition-opacity hover:opacity-70"
            style={{ backgroundColor: newColor }}
          />
          <input
            ref={nameRef}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) handleAdd();
            }}
            maxLength={30}
            placeholder="status name"
            disabled={addPending}
            className={cn(BORDER_INPUT, "border-border flex-1")}
          />
          <BracketButton onClick={handleAdd} disabled={!newName.trim() || addPending}>
            add
          </BracketButton>
        </div>
        {newColorOpen && (
          <ColorSwatches
            current={newColor}
            onChange={(c) => {
              setNewColor(c);
              setNewColorOpen(false);
            }}
          />
        )}
        {error && <span className="text-destructive font-mono text-[10px]">{error}</span>}
      </div>
    </>
  );
}
