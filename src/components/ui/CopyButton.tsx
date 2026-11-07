"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { TextButton } from "./TextButton";

type CopyButtonProps = Omit<ComponentProps<"button">, "children"> & {
  copied: boolean;
  label?: string;
};

export function CopyButton({ copied, label = "copy", className, ...props }: CopyButtonProps) {
  return (
    <TextButton
      type="button"
      variant="ghost"
      icon={copied ? "check" : "copy"}
      iconLabel={copied ? "copied" : label}
      className={cn("shrink-0", className)}
      {...props}
    >
      {copied ? "copied" : label}
    </TextButton>
  );
}
