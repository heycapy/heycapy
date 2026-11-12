import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "border-border bg-muted text-foreground rounded-control font-ui text-2xs inline-flex min-w-5 items-center justify-center border px-1.5 leading-4",
        className
      )}
      {...props}
    />
  );
}
