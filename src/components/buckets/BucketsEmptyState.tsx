"use client";

import { Sprite } from "@/components/capy/Sprite";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function BucketsEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
      <Sprite id="capy-idle-blink" size={96} />
      <div className="text-center">
        <p className="text-sm font-medium">No buckets yet.</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Create your first bucket to get started.
        </p>
      </div>
      <Button className="w-auto gap-2 px-4 py-2 text-xs">
        <Plus size={12} />
        New bucket
      </Button>
    </div>
  );
}
