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
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-control font-ui min-h-(--control-h) shrink-0 px-2 text-xs whitespace-nowrap transition-colors",
        active && "bg-(--tab-active-bg) text-(--tab-active-fg)",
        !active && tone === "primary" && "hover:text-foreground text-(--button-accent)",
        !active && tone === "muted" && "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}
