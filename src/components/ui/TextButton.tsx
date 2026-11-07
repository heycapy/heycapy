"use client";

import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import type { LookParts } from "@/components/looks/constants";
import type { ComponentProps, ReactNode } from "react";

type Variant = "default" | "inverted" | "destructive" | "warning";

interface TextButtonProps extends ComponentProps<"button"> {
  /**
   * default     — base: text-muted-foreground, hover: text-foreground.
   * inverted    — used on inverted bg (title bars with bg-foreground). opacity-based.
   * destructive — base: text-muted-foreground, hover: text-destructive (red).
   * warning     — base: text-muted-foreground, hover: text-warning (yellow).
   */
  variant?: Variant;
}

function textButtonClass(shape: LookParts["textButton"], variant: Variant, className?: string) {
  return cn(
    "rounded-control font-ui inline-flex items-center text-xs transition-colors disabled:opacity-25",
    shape === "bracketed" && "py-1",
    shape === "plain" && "min-h-11 justify-center px-3 md:min-h-10",
    shape === "plain" && variant !== "inverted" && "hover:bg-muted",
    variant === "default" && "text-muted-foreground hover:text-foreground",
    variant === "inverted" && "opacity-60 transition-opacity hover:opacity-100",
    variant === "destructive" && "text-muted-foreground hover:text-destructive",
    variant === "warning" && "text-muted-foreground hover:text-warning",
    className
  );
}

function Label({ shape, children }: { shape: LookParts["textButton"]; children: ReactNode }) {
  if (shape === "plain") return children;
  return (
    <>
      <span className="opacity-50">[</span>
      {children}
      <span className="opacity-50">]</span>
    </>
  );
}

export function TextButton({
  variant = "default",
  className,
  children,
  ...props
}: TextButtonProps) {
  const shape = useLookParts().textButton;
  return (
    <button
      data-variant={variant}
      className={textButtonClass(shape, variant, className)}
      {...props}
    >
      <Label shape={shape}>{children}</Label>
    </button>
  );
}

export function TextLink({
  variant = "default",
  className,
  children,
  ...props
}: ComponentProps<"a"> & { variant?: Variant }) {
  const shape = useLookParts().textButton;
  return (
    <a className={textButtonClass(shape, variant, className)} {...props}>
      <Label shape={shape}>{children}</Label>
    </a>
  );
}
