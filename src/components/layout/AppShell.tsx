"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { Header } from "./Header";
import { SettingsSheet, type SettingsTab } from "./SettingsSheet";
import { DeliveryFailureBanner } from "./DeliveryFailureBanner";
import { NoChannelBanner } from "./NoChannelBanner";
import { ArchivedBucketsSheet } from "@/components/buckets/ArchivedBucketsSheet";
import { TrashSheet } from "@/components/buckets/TrashSheet";
import { SearchDrawer } from "@/components/search/SearchDrawer";
import { useUIStore } from "@/store/ui";
import { useChatStore } from "@/store/chat";
import { useServerEvents } from "@/hooks/useServerEvents";
import type { ChannelFailure } from "@/lib/notifications/failures";

const CapyChat = dynamic(() => import("@/components/capy/CapyChat").then((m) => m.CapyChat), {
  ssr: false,
});

type AppShellProps = {
  children: ReactNode;
  email: string;
  failures: ChannelFailure[];
  hasWorkingChannel: boolean;
};

export function AppShell({ children, email, failures, hasWorkingChannel }: AppShellProps) {
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  useServerEvents();

  useEffect(() => {
    void useUIStore.persist.rehydrate();
    void useChatStore.persist.rehydrate();
  }, []);

  return (
    <>
      <Header
        email={email}
        onSettingsOpen={() => setSettingsTab("appearance")}
        onArchiveOpen={() => setArchivedOpen(true)}
        onTrashOpen={() => setTrashOpen(true)}
      />
      {!hasWorkingChannel && <NoChannelBanner onSetUp={() => setSettingsTab("notifications")} />}
      <DeliveryFailureBanner failures={failures} onFix={() => setSettingsTab("notifications")} />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      <SettingsSheet
        open={settingsTab !== null}
        initialTab={settingsTab ?? "appearance"}
        onClose={() => setSettingsTab(null)}
      />
      <ArchivedBucketsSheet open={archivedOpen} onClose={() => setArchivedOpen(false)} />
      <TrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
      <SearchDrawer />
      <CapyChat />
    </>
  );
}
