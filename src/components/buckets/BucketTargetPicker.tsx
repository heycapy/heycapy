"use client";

import { useEffect, useRef, useState } from "react";
import { MenuItem } from "@/components/ui/MenuItem";
import { MENU_SURFACE } from "@/components/ui/constants";
import { cn } from "@/lib/utils";
import type { ViewerBucket } from "@/lib/buckets/access";
import { bucketColor } from "./bucket-color";

type BucketTargetPickerProps = {
  bucket: ViewerBucket | null;
  buckets: ViewerBucket[];
  onPick: (bucketId: number) => void;
  variant?: "target" | "heading";
  today?: () => void;
};

function nameOf(bucket: ViewerBucket | null) {
  if (!bucket) return "today";
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

export function BucketTargetPicker({
  bucket,
  buckets,
  onPick,
  variant = "target",
  today,
}: BucketTargetPickerProps) {
  const heading = variant === "heading";
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
        aria-label={
          heading ? `${nameOf(bucket)}, change bucket` : `add to ${nameOf(bucket)}, change bucket`
        }
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "rounded-control font-ui text-foreground hover:bg-muted flex items-center gap-1.5 px-1.5 py-1 transition-colors",
          heading ? "max-w-full text-base font-medium" : "max-w-28 text-xs"
        )}
      >
        {bucket && <Dot bucket={bucket} />}
        <span className="truncate">{nameOf(bucket)}</span>
      </button>
      {open && (
        <div
          role="group"
          aria-label={heading ? "change bucket" : "add to bucket"}
          className={cn(
            MENU_SURFACE,
            "absolute left-0 z-30 max-h-72 min-w-44 overflow-y-auto",
            heading ? "top-full mt-2" : "bottom-full mb-2"
          )}
        >
          {today && (
            <MenuItem
              aria-current={bucket === null ? "true" : undefined}
              onClick={() => {
                setOpen(false);
                today();
              }}
              className={cn(bucket === null && "text-foreground font-medium")}
            >
              today
            </MenuItem>
          )}
          {buckets.map((b) => (
            <MenuItem
              key={b.id}
              aria-current={b.id === bucket?.id ? "true" : undefined}
              onClick={() => {
                setOpen(false);
                onPick(b.id);
              }}
              className={cn("gap-2", b.id === bucket?.id && "text-foreground font-medium")}
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
