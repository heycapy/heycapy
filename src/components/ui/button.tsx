"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";
import { Spinner } from "./spinner";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
  loading?: boolean;
}

export function Button({
  variant = "primary",
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "relative flex w-full cursor-pointer items-center justify-center rounded-md px-3 py-2.5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "ghost" && "text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      <span className={cn(loading && "invisible")}>{children}</span>
      {loading && <Spinner className="absolute" />}
    </button>
  );
}
