import type { ReactNode } from "react";
import { Kbd } from "@/components/ui/Kbd";
import { cn } from "@/lib/utils";

export type NoteTone = "hint" | "warn";

export function KeyNote({ tone = "hint", children }: { tone?: NoteTone; children: ReactNode }) {
  return (
    <p
      role="status"
      className={cn(
        "rounded-control font-ui text-2xs px-2.5 py-2 leading-snug",
        tone === "warn"
          ? "bg-warning/10 text-warning"
          : "bg-(--button-accent)/10 text-(--button-accent)"
      )}
    >
      {children}
    </p>
  );
}

export function InlineButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:text-foreground underline underline-offset-2"
    >
      {children}
    </button>
  );
}

type KeyRowProps = { label: string; keyLabel: string; active?: boolean; children: ReactNode };

export function KeyRow({ label, keyLabel, active, children }: KeyRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-foreground font-ui min-w-0 flex-1 truncate text-xs">{label}</span>
      <Kbd className={cn(active && "border-(--button-accent) text-(--button-accent)")}>
        {keyLabel}
      </Kbd>
      <span className="font-ui text-muted-foreground flex min-w-20 items-center justify-end text-xs">
        {children}
      </span>
    </div>
  );
}
