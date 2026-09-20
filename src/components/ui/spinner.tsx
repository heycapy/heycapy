"use client";

import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center gap-1", className)}>
      <span
        className="h-1 w-1 animate-bounce rounded-full bg-current"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="h-1 w-1 animate-bounce rounded-full bg-current"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="h-1 w-1 animate-bounce rounded-full bg-current"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}
