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
        "hover:bg-muted rounded-control font-ui flex w-full items-center px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-50 sm:py-2",
        tone === "destructive" && "text-destructive",
        className
      )}
      {...props}
    />
  );
}

export function MenuSection({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "border-border border-rule -mx-(--menu-inset) border-t px-(--menu-inset) py-1",
        className
      )}
      {...props}
    />
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      className={cn("border-border -mx-(--menu-inset) my-1 border-t", className)}
    />
  );
}
