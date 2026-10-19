import type { ReactNode } from "react";
import { OptionButton } from "@/components/ui/OptionButton";
import { MEDIUM_OPTIONS, type NotificationMedium } from "./constants";
import { HINT, LABEL } from "@/components/layout/settings-constants";

export type NotifAvailability = {
  email: boolean;
  ntfy: boolean;
  telegram: boolean;
  push: boolean;
  webhooks: { id: number; name: string }[];
};

const WARNING = "text-warning font-mono text-[11px]";

type MyChannelsPickerProps = {
  mediums: NotificationMedium[];
  webhooks: number[];
  onMediumToggle: (m: NotificationMedium) => void;
  onWebhookToggle: (id: number) => void;
  notifAvailability?: NotifAvailability;
  labelTag?: ReactNode;
};

export function MyChannelsPicker({
  mediums,
  webhooks,
  onMediumToggle,
  onWebhookToggle,
  notifAvailability,
  labelTag,
}: MyChannelsPickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div data-label-row className="flex items-center justify-between gap-2">
        <label className={LABEL}>channels</label>
        {labelTag}
      </div>
      <span className={HINT}>
        where your reminders from this bucket go
        {notifAvailability?.webhooks.length === 0 &&
          " · discord, slack or your own server: tweaks → notifications → other apps"}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {MEDIUM_OPTIONS.map((option) => (
          <OptionButton
            key={option.value}
            active={mediums.includes(option.value)}
            onClick={() => onMediumToggle(option.value)}
          >
            {option.label}
          </OptionButton>
        ))}
        {notifAvailability?.webhooks.map((webhook) => (
          <OptionButton
            key={`webhook:${webhook.id}`}
            active={webhooks.includes(webhook.id)}
            onClick={() => onWebhookToggle(webhook.id)}
          >
            {webhook.name}
          </OptionButton>
        ))}
      </div>
      {notifAvailability && mediums.length > 0 && (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {mediums.includes("email") && !notifAvailability.email && (
            <span className={WARNING}>⚠ email not configured — set up in tweaks</span>
          )}
          {mediums.includes("ntfy") && !notifAvailability.ntfy && (
            <span className={WARNING}>
              ⚠ ntfy not configured — add server url + topic in tweaks
            </span>
          )}
          {mediums.includes("telegram") && !notifAvailability.telegram && (
            <span className={WARNING}>⚠ telegram not connected — set up in tweaks</span>
          )}
          {mediums.includes("push") && !notifAvailability.push && (
            <span className={WARNING}>⚠ push is off on every device — turn it on in tweaks</span>
          )}
        </div>
      )}
    </div>
  );
}
