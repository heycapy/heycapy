"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { addItemAction } from "@/app/(app)/actions";

interface AddItemFormProps {
  bucketId: number;
  onClose: () => void;
}

export function AddItemForm({ bucketId, onClose }: AddItemFormProps) {
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => titleRef.current?.focus(), 30);
    return () => clearTimeout(id);
  }, []);

  function handleSave() {
    setError("");
    startTransition(async () => {
      const result = await addItemAction(bucketId, title, deadline || null);
      if (result.ok) {
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="border-border border-b px-3 py-2.5">
      <div className="flex items-center gap-2">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) handleSave();
            if (e.key === "Escape") onClose();
          }}
          placeholder="What needs doing?"
          maxLength={500}
          disabled={pending}
          className="placeholder:text-muted-foreground flex-1 bg-transparent text-sm outline-none disabled:opacity-50"
        />
        <DatePicker value={deadline} onChange={setDeadline} disabled={pending} />
      </div>

      <div className="mt-2 flex items-center justify-end gap-3">
        {error && <p className="text-destructive mr-auto font-mono text-xs">{error}</p>}
        <button
          onClick={onClose}
          disabled={pending}
          className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors disabled:opacity-50"
        >
          <span className="opacity-50">[</span>cancel<span className="opacity-50">]</span>
        </button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || pending}
          className="text-muted-foreground hover:text-foreground font-mono text-xs transition-colors disabled:opacity-30"
        >
          <span className="opacity-50">[</span>add<span className="opacity-50">]</span>
        </button>
      </div>
    </div>
  );
}
