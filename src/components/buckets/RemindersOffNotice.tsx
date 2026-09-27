"use client";

import { useEffect, useState } from "react";
import { BracketButton } from "@/components/ui/BracketButton";
import { getNotifAvailabilityAction } from "@/app/(app)/actions";
import type { NotificationMedium } from "./constants";

interface RemindersOffNoticeProps {
  notificationsRules: string;
  hasDatedItems: boolean;
  onSetUp: () => void;
}

function bucketChannels(notificationsRules: string): NotificationMedium[] {
  try {
    const medium = (JSON.parse(notificationsRules) as { medium?: unknown }).medium;
    return Array.isArray(medium) ? (medium as NotificationMedium[]) : [];
  } catch {
    return [];
  }
}

export function RemindersOffNotice({
  notificationsRules,
  hasDatedItems,
  onSetUp,
}: RemindersOffNoticeProps) {
  const [working, setWorking] = useState<NotificationMedium[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getNotifAvailabilityAction().then((available) => {
      if (cancelled) return;
      setWorking((Object.keys(available) as NotificationMedium[]).filter((m) => available[m]));
    });
    return () => {
      cancelled = true;
    };
  }, [notificationsRules]);

  if (!hasDatedItems || working === null) return null;
  if (bucketChannels(notificationsRules).some((m) => working.includes(m))) return null;

  return (
    <div
      role="status"
      className="border-border text-warning mx-4 mb-3 flex items-center justify-between gap-3 border border-dashed px-3 py-2 font-mono text-[10px]"
    >
      <span>⚠ this bucket won&apos;t send reminders — no working notification channel</span>
      <BracketButton onClick={onSetUp} className="shrink-0">
        set up
      </BracketButton>
    </div>
  );
}
