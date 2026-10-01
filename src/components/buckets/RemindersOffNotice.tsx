import { bucketChannels } from "@/lib/rules";
import { useEffect, useState } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { getNotifAvailabilityAction } from "@/app/(app)/actions";
import { MEDIUM_OPTIONS, type NotificationMedium } from "./constants";

type RemindersOffNoticeProps = {
  notificationsRules: string;
  hasDatedItems: boolean;
  onSetUp: () => void;
};

export function RemindersOffNotice({
  notificationsRules,
  hasDatedItems,
  onSetUp,
}: RemindersOffNoticeProps) {
  const [working, setWorking] = useState<{
    channels: NotificationMedium[];
    webhookIds: number[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getNotifAvailabilityAction().then((available) => {
      if (cancelled) return;
      setWorking({
        channels: MEDIUM_OPTIONS.map((o) => o.value).filter((m) => available[m]),
        webhookIds: available.webhooks.map((w) => w.id),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [notificationsRules]);

  if (!hasDatedItems || working === null) return null;
  if (working.channels.length === 0 && working.webhookIds.length === 0) return null;
  const picked = bucketChannels(notificationsRules);
  if (
    picked.medium.some((m) => working.channels.includes(m)) ||
    picked.webhooks.some((id) => working.webhookIds.includes(id))
  ) {
    return null;
  }

  return (
    <div
      role="status"
      className="border-border text-warning mx-4 mb-3 flex items-center justify-between gap-3 border border-dashed px-3 py-2 font-mono text-xs"
    >
      <span>⚠ this bucket won&apos;t send reminders — no working notification channel</span>
      <BracketButton onClick={onSetUp} className="shrink-0">
        set up
      </BracketButton>
    </div>
  );
}
