import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";
import { Icon } from "./Icon";
import type { IconName } from "./icons";

type IconButtonProps = Omit<ComponentProps<"button">, "children"> & {
  icon: IconName;
  "aria-label": string;
  tone?: "default" | "destructive";
};

export function IconButton({ icon, tone = "default", className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "text-muted-foreground rounded-control shrink-0 transition-colors",
        tone === "default" && "hover:text-foreground",
        tone === "destructive" && "hover:text-destructive",
        className
      )}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
