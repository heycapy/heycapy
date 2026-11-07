"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import { Icon } from "./Icon";
import { TextButton } from "./TextButton";

type CloseButtonProps = Omit<ComponentProps<"button">, "children"> & {
  variant?: "default" | "inverted";
};

export function CloseButton({ variant = "default", className, ...props }: CloseButtonProps) {
  if (useLookParts().textButton === "bracketed") {
    return (
      <TextButton type="button" variant={variant} className={className} {...props}>
        x
      </TextButton>
    );
  }
  return (
    <button
      type="button"
      aria-label="close"
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground rounded-control flex size-(--control-h) shrink-0 items-center justify-center transition-colors",
        className,
        "p-0"
      )}
      {...props}
    >
      <Icon name="close" />
    </button>
  );
}
