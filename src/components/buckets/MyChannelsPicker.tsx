import { OptionButton } from "@/components/ui/OptionButton";
import { MEDIUM_OPTIONS, type NotificationMedium } from "./constants";

export type NotifAvailability = {
  email: boolean;
  ntfy: boolean;
  telegram: boolean;
  push: boolean;
  webhooks: { id: number; name: string }[];
};

const LABEL = "text-muted-foreground font-mono text-xs";
const HINT = "text-muted-foreground font-mono text-[11px] leading-tight";
const WARNING = "text-warning font-mono text-[11px]";

type MyChannelsPickerProps = {
  mediums: NotificationMedium[];
  webhooks: number[];
  onMediumToggle: (m: NotificationMedium) => void;
  onWebhookToggle: (id: number) => void;
  notifAvailability?: NotifAvailability;
};

export function MyChannelsPicker({
  mediums,
  webhooks,
  onMediumToggle,
  onWebhookToggle,
  notifAvailability,
}: MyChannelsPickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL}>channels</label>
      <span className={HINT}>
        where your reminders from this bucket go
        {notifAvailability?.webhooks.length === 0 &&
          " · add discord, slack or your own server in tweaks → notifications → other apps"}
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
