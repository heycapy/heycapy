import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type KbdProps = { className?: string; children: ReactNode };

export function Kbd({ className, children }: KbdProps) {
  return (
    <kbd
      className={cn(
        "border-border bg-muted text-foreground rounded-control font-ui text-2xs inline-flex min-w-5 items-center justify-center border px-1.5 leading-4",
        className
      )}
    >
      {children}
    </kbd>
  );
}
