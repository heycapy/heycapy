"use client";

import { useEffect, useRef, useState } from "react";
import { MenuItem } from "@/components/ui/MenuItem";
import { MENU_SURFACE } from "@/components/ui/constants";
import { cn } from "@/lib/utils";
import type { ViewerBucket } from "@/lib/buckets/access";
import { bucketColor } from "./bucket-color";

type BucketTargetPickerProps = {
  bucket: ViewerBucket;
  buckets: ViewerBucket[];
  onPick: (bucketId: number) => void;
};

function nameOf(bucket: ViewerBucket) {
  return bucket.icon ? `${bucket.icon} ${bucket.name}` : bucket.name;
}

function Dot({ bucket }: { bucket: ViewerBucket }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-(--dot-radius)"
      style={{ backgroundColor: bucketColor(bucket.colorIndex) }}
    />
  );
}

export function BucketTargetPicker({ bucket, buckets, onPick }: BucketTargetPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative shrink-0" data-handles-escape={open || undefined}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`add to ${nameOf(bucket)}, change bucket`}
        onClick={() => setOpen((v) => !v)}
        className="rounded-control font-ui text-foreground hover:bg-muted flex max-w-28 items-center gap-1.5 px-1.5 py-1 text-xs transition-colors"
      >
        <Dot bucket={bucket} />
        <span className="truncate">{nameOf(bucket)}</span>
      </button>
      {open && (
        <div
          role="group"
          aria-label="add to bucket"
          className={cn(
            MENU_SURFACE,
            "absolute bottom-full left-0 z-30 mb-2 max-h-72 min-w-44 overflow-y-auto"
          )}
        >
          {buckets.map((b) => (
            <MenuItem
              key={b.id}
              aria-current={b.id === bucket.id ? "true" : undefined}
              onClick={() => {
                setOpen(false);
                onPick(b.id);
              }}
              className={cn("gap-2", b.id === bucket.id && "text-foreground font-medium")}
            >
              <Dot bucket={b} />
              <span className="truncate">{nameOf(b)}</span>
            </MenuItem>
          ))}
        </div>
      )}
    </span>
  );
}
