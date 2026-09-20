"use client";

import { cn } from "@/lib/utils";
import { type InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border px-3 py-2.5 text-sm outline-none focus:ring-1",
        className
      )}
      {...props}
    />
  );
}
