"use client";

import { Plus } from "lucide-react";
import { useUIStore } from "@/store/ui";

export function NewBucketButton() {
  const { openCreateBucket } = useUIStore();
  return (
    <button
      onClick={openCreateBucket}
      className="border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30 flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-xs transition-colors"
    >
      <Plus size={12} />
      New bucket
    </button>
  );
}
