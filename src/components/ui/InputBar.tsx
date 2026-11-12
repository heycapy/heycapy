"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./IconButton";
import { Icon } from "./Icon";
import { Tooltip } from "./Tooltip";
import type { IconName } from "./icons";
import { KeyHint } from "./KeyHint";
import type { KeybindActionId } from "@/lib/keybinds/constants";

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
  hint?: KeybindActionId;
  disabled?: boolean;
  onClick: () => void;
};

export function InputBarIcon({ icon, label, tip, hint, disabled, onClick }: InputBarIconProps) {
  return (
    <span className="flex shrink-0 items-center">
      <Tooltip text={tip ?? label} className="shrink-0">
        <IconButton
          icon={icon}
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className="flex size-(--add-icon) items-center justify-center disabled:opacity-40"
        />
      </Tooltip>
      {hint && <KeyHint action={hint} className="ml-0" />}
    </span>
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
    <Tooltip text={label} className="shrink-0">
      <button
        type="button"
        aria-label={name ?? label}
        disabled={disabled}
        onClick={onClick}
        className="group/action flex h-(--add-icon) items-center pl-1 disabled:opacity-40"
      >
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-(--dot-radius) transition-opacity group-hover/action:opacity-85",
            variant === "primary"
              ? "bg-primary text-primary-foreground"
              : "bg-destructive text-background"
          )}
        >
          <Icon name={icon} />
        </span>
      </button>
    </Tooltip>
  );
}
