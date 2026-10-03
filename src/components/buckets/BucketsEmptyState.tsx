"use client";

import { useState } from "react";
import { Sprite } from "@/components/capy/Sprite";
import { BracketButton } from "@/components/ui/BracketButton";
import { useUIStore } from "@/store/ui";
import { ArchivedBucketsSheet } from "./ArchivedBucketsSheet";
import { TrashSheet } from "./TrashSheet";

type BucketsEmptyStateProps = {
  hasArchived: boolean;
  hasTrash: boolean;
};

export function BucketsEmptyState({ hasArchived, hasTrash }: BucketsEmptyStateProps) {
  const { openCreateBucket } = useUIStore();
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <Sprite id="capy-idle-blink" size={96} />
      <div className="text-center font-mono">
        <p className="text-sm">no buckets yet.</p>
        <p className="text-muted-foreground mt-1 text-xs">
          create your first bucket to get started.
        </p>
      </div>
      <BracketButton onClick={openCreateBucket} className="text-foreground text-sm">
        new bucket
      </BracketButton>
      {(hasArchived || hasTrash) && (
        <div className="flex gap-4">
          {hasArchived && (
            <BracketButton onClick={() => setArchivedOpen(true)}>archived</BracketButton>
          )}
          {hasTrash && <BracketButton onClick={() => setTrashOpen(true)}>trash</BracketButton>}
        </div>
      )}

      <ArchivedBucketsSheet open={archivedOpen} onClose={() => setArchivedOpen(false)} />
      <TrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
    </div>
  );
}
