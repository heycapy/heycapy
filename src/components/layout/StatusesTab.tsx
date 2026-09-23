"use client";

import { LABEL } from "./settings-constants";

export function StatusesTab() {
  return (
    <div className="flex flex-col gap-2">
      <label className={LABEL}>statuses</label>
      <p className="text-muted-foreground font-mono text-[10px] leading-relaxed">
        Statuses are now defined per bucket. Open bucket settings to configure statuses for each
        bucket individually.
      </p>
    </div>
  );
}
