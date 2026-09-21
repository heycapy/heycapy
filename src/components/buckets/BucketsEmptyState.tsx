"use client";

import { useState } from "react";
import { Sprite } from "@/components/capy/Sprite";
import { Button } from "@/components/ui/button";
import { Archive, Plus, Trash2 } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { ArchivedBucketsSheet } from "./ArchivedBucketsSheet";
import { TrashSheet } from "./TrashSheet";

export function BucketsEmptyState() {
  const { openCreateBucket } = useUIStore();
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
        <Sprite id="capy-idle-blink" size={96} />
        <div className="text-center">
          <p className="text-sm font-medium">No buckets yet.</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Create your first bucket to get started.
          </p>
        </div>
        <Button className="w-auto gap-2 px-4 py-2 text-xs" onClick={openCreateBucket}>
          <Plus size={12} />
          New bucket
        </Button>
      </div>

      <div className="border-border bg-background sticky bottom-0 border-t-2">
        <div className="flex">
          <button
            onClick={openCreateBucket}
            className="text-muted-foreground hover:text-foreground shrink-0 px-3 py-2.5 transition-colors"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => setArchivedOpen(true)}
            className="text-muted-foreground hover:text-foreground shrink-0 px-3 py-2.5 transition-colors"
          >
            <Archive size={12} />
          </button>
          <button
            onClick={() => setTrashOpen(true)}
            className="text-muted-foreground hover:text-foreground shrink-0 px-3 py-2.5 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <ArchivedBucketsSheet open={archivedOpen} onClose={() => setArchivedOpen(false)} />
      <TrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
    </div>
  );
}
