"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import { TextButton } from "./TextButton";
import { Tooltip } from "./Tooltip";
import type { IconName } from "./icons";

export function InputBar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex min-h-(--add-box-h) items-center gap-1 pr-2 pl-2.5", className)}>
      {children}
    </div>
  );
}

type InputBarIconProps = {
  icon: IconName;
  label: string;
  tip?: string;
  disabled?: boolean;
  onClick: () => void;
};

export function InputBarIcon({ icon, label, tip, disabled, onClick }: InputBarIconProps) {
  return (
    <Tooltip text={tip ?? label} className="shrink-0">
      <IconButton
        icon={icon}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className="flex size-(--add-icon) items-center justify-center disabled:opacity-40"
      />
    </Tooltip>
  );
}

type InputBarActionProps = {
  icon: IconName;
  label: string;
  name?: string;
  variant?: "primary" | "destructive";
  disabled?: boolean;
  onClick: () => void;
};

export function InputBarAction({
  icon,
  label,
  name,
  variant = "primary",
  disabled,
  onClick,
}: InputBarActionProps) {
  return (
    <TextButton
      variant={variant}
      icon={icon}
      iconLabel={name ?? label}
      aria-label={name ?? label}
      disabled={disabled}
      onClick={onClick}
      className="shrink-0"
    >
      {label}
    </TextButton>
  );
}
