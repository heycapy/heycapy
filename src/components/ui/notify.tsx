"use client";

import { isValidElement, type ReactElement } from "react";
import { toast } from "sonner";
import { useLookParts } from "@/components/looks/LookProvider";
import { cn } from "@/lib/utils";
import { Icon } from "./Icon";
import type { IconName } from "./icons";
import { NOTIFY_LIMIT, NOTIFY_MS } from "./constants";

type Tone = "info" | "error";

type NotifyOptions = {
  description?: string;
  icon?: IconName | ReactElement;
  action?: { label: string; onClick: () => void };
  // shows the time left as a shrinking line, for toasts whose action stops working when they close
  countdown?: boolean;
  duration?: number;
};

type ToastProps = NotifyOptions & { id: string | number; tone: Tone; message: string };

function Toast({ id, tone, message, description, icon, action, countdown, duration }: ToastProps) {
  const bracketed = useLookParts().textButton === "bracketed";
  const error = tone === "error";
  const dismiss = () => toast.dismiss(id);
  const label = (text: string) =>
    bracketed ? (
      <>
        <span aria-hidden>[</span>
        {text}
        <span aria-hidden>]</span>
      </>
    ) : (
      text
    );

  return (
    <div
      role={error ? "alert" : "status"}
      onKeyDown={(e) => {
        if (e.key === "Escape") dismiss();
      }}
      className={cn(
        "font-ui relative flex min-h-(--toast-h) w-max max-w-[min(26rem,calc(100vw-2rem))] items-center gap-2 overflow-hidden py-1 pl-3 text-xs",
        "rounded-(--toast-radius) border-(length:--toast-border) shadow-(--toast-shadow)",
        error
          ? "border-(--toast-error-border) bg-(--toast-error-bg) text-(--toast-error-fg)"
          : "border-(--toast-border-color) bg-(--toast-bg) text-(--toast-fg)"
      )}
    >
      <span
        aria-hidden
        className={cn("flex shrink-0 items-center", error && "text-(--toast-error-icon)")}
      >
        {isValidElement(icon) ? icon : <Icon name={icon ?? (error ? "warning" : "check")} />}
      </span>
      <span className="line-clamp-2 min-w-0 leading-snug">
        {message}
        {description && <span className="opacity-75"> · {description}</span>}
      </span>
      {action && (
        <button
          type="button"
          onClick={() => {
            dismiss();
            action.onClick();
          }}
          className={cn(
            "shrink-0 self-stretch px-2 font-semibold hover:underline",
            !error && "text-(--toast-action)"
          )}
        >
          {label(action.label)}
        </button>
      )}
      <button
        type="button"
        aria-label="dismiss"
        onClick={dismiss}
        className="flex shrink-0 items-center self-stretch px-2 opacity-75 hover:opacity-100"
      >
        {bracketed ? label("x") : <Icon name="close" />}
      </button>
      {countdown && (
        <span
          aria-hidden
          data-countdown
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current opacity-35"
          style={{ animation: `countdown ${duration}ms linear forwards` }}
        />
      )}
    </div>
  );
}

const open: (string | number)[] = [];

function forget(id: string | number) {
  const at = open.indexOf(id);
  if (at >= 0) open.splice(at, 1);
}

function show(tone: Tone, message: string, options: NotifyOptions = {}) {
  const duration =
    options.duration ??
    (tone === "error" ? NOTIFY_MS.error : options.action ? NOTIFY_MS.action : NOTIFY_MS.info);
  const id = toast.custom(
    (id) => <Toast id={id} tone={tone} message={message} {...options} duration={duration} />,
    { duration, onDismiss: (t) => forget(t.id), onAutoClose: (t) => forget(t.id) }
  );
  open.push(id);
  while (open.length > NOTIFY_LIMIT) {
    const oldest = open.shift();
    if (oldest !== undefined) toast.dismiss(oldest);
  }
  return id;
}

export const notify = {
  info: (message: string, options?: NotifyOptions) => show("info", message, options),
  error: (message: string, options?: NotifyOptions) => show("error", message, options),
  dismiss: (id: string | number) => toast.dismiss(id),
};
