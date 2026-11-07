"use client";

import { cn } from "@/lib/utils";
import { useLookParts } from "@/components/looks/LookProvider";
import type { LookParts } from "@/components/looks/constants";
import type { ComponentProps, ReactNode } from "react";

type Variant = "default" | "primary" | "ghost" | "inverted" | "destructive" | "warning";

interface TextButtonProps extends ComponentProps<"button"> {
  /**
   * default     — base: text-muted-foreground, hover: text-foreground.
   * primary     — the main action of a form or bar (save, add, update).
   * ghost       — a button in a bar or toolbar; no frame in looks that frame buttons.
   * inverted    — used on inverted bg (title bars with bg-foreground). opacity-based.
   * destructive — base: text-muted-foreground, hover: text-destructive (red).
   * warning     — base: text-muted-foreground, hover: text-warning (yellow).
   */
  variant?: Variant;
}

function textButtonClass(shape: LookParts["textButton"], variant: Variant, className?: string) {
  const plain = shape === "plain";
  return cn(
    "rounded-control font-ui inline-flex items-center text-xs transition-colors",
    !plain && "py-1 disabled:opacity-25",
    plain && "min-h-(--control-h) justify-center border px-3 whitespace-nowrap disabled:opacity-40",
    plain &&
      variant !== "primary" &&
      variant !== "ghost" &&
      "border-border hover:bg-muted text-foreground",
    (variant === "default" || variant === "ghost") &&
      !plain &&
      "text-muted-foreground hover:text-foreground",
    variant === "ghost" &&
      plain &&
      "text-muted-foreground hover:bg-muted hover:text-foreground border-transparent",
    variant === "primary" && !plain && "text-foreground",
    variant === "primary" &&
      plain &&
      "bg-primary text-primary-foreground border-transparent font-medium hover:opacity-90",
    variant === "inverted" && "opacity-60 transition-opacity hover:opacity-100",
    variant === "destructive" &&
      (plain
        ? "text-destructive hover:bg-destructive/10"
        : "text-muted-foreground hover:text-destructive"),
    variant === "warning" &&
      (plain ? "text-warning hover:bg-warning/10" : "text-muted-foreground hover:text-warning"),
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
