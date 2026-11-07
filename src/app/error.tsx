"use client";

import { Sprite } from "@/components/capy/Sprite";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <Sprite id="capy-error" size={96} />
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="font-display text-sm">something went wrong</p>
        <p className="text-muted-foreground font-ui text-xs">capy is a bit confused right now</p>
      </div>
      <button
        onClick={reset}
        className="rounded-control border-border text-muted-foreground hover:text-foreground font-ui border px-3 py-1.5 text-xs transition-colors"
      >
        try again
      </button>
    </div>
  );
}
