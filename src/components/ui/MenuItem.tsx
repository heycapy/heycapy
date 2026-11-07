import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

type MenuItemProps = ComponentProps<"button"> & {
  tone?: "default" | "destructive";
};

export function MenuItem({ tone = "default", className, ...props }: MenuItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "hover:bg-muted flex w-full items-center px-3 py-2.5 text-left font-mono text-xs transition-colors disabled:opacity-50 sm:py-2",
        tone === "destructive" && "text-destructive",
        className
      )}
      {...props}
    />
  );
}
