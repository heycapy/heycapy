import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type TabProps = ComponentProps<"button"> & {
  active: boolean;
  tone?: "primary" | "muted";
};

export function Tab({ active, tone = "primary", className, ...props }: TabProps) {
  return (
    <button
      type="button"
      className={cn(
        "shrink-0 px-2 font-mono text-xs whitespace-nowrap transition-colors",
        active && "bg-foreground text-background",
        !active && tone === "primary" && "text-primary hover:text-foreground",
        !active && tone === "muted" && "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}
