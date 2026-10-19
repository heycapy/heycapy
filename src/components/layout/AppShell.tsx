"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { Header } from "./Header";
import { SettingsSheet, type SettingsTab } from "./SettingsSheet";
import { DeliveryFailureBanner } from "./DeliveryFailureBanner";
import { PurchaseReturn } from "./PurchaseReturn";
import { NoChannelBanner } from "./NoChannelBanner";
import { ArchivedBucketsSheet } from "@/components/buckets/ArchivedBucketsSheet";
import { TrashSheet } from "@/components/buckets/TrashSheet";
import { JoinBucketDialog } from "@/components/buckets/JoinBucketDialog";
import { SearchDrawer } from "@/components/search/SearchDrawer";
import { useUIStore } from "@/store/ui";
import { useChatStore } from "@/store/chat";
import { useTimezoneStore } from "@/store/timezone";
import { TimezoneMoveBanner } from "./TimezoneMoveBanner";
import { NewVersionBanner } from "./NewVersionBanner";
import { FeedbackDialog } from "./FeedbackDialog";
import { WhatsNewDialog } from "./WhatsNewDialog";
import { markReleasesSeenAction } from "@/app/(app)/account-actions";
import { saveTimezoneIfDefaultAction } from "@/app/(app)/user-settings-actions";
import { useServerEvents } from "@/hooks/useServerEvents";
import { AssistantNameProvider } from "@/components/capy/assistant-name";
import type { ChannelFailure } from "@/lib/notifications/failures";

const CapyChat = dynamic(() => import("@/components/capy/CapyChat").then((m) => m.CapyChat), {
  ssr: false,
});

type AppShellProps = {
  children: ReactNode;
  email: string;
  userId: number;
  avatar: string | null;
  failures: ChannelFailure[];
  hasWorkingChannel: boolean;
  assistantName: string;
  feedbackEnabled: boolean;
  unseenRelease: boolean;
};

export function AppShell({
  children,
  email,
  userId,
  avatar,
  failures,
  hasWorkingChannel,
  assistantName,
  feedbackEnabled,
  unseenRelease,
}: AppShellProps) {
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [releaseUnseen, setReleaseUnseen] = useState(unseenRelease);

  function openWhatsNew() {
    setWhatsNewOpen(true);
    if (!releaseUnseen) return;
    setReleaseUnseen(false);
    void markReleasesSeenAction();
  }

  const newVersion = useServerEvents();

  useEffect(() => {
    void useUIStore.persist.rehydrate();
    void useChatStore.persist.rehydrate();
    void useTimezoneStore.persist.rehydrate();
    void saveTimezoneIfDefaultAction(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <>
      <PurchaseReturn onPaid={() => setSettingsTab("credits")} />
      <Header
        email={email}
        userId={userId}
        avatar={avatar}
        onSettingsOpen={() => setSettingsTab("appearance")}
        onArchiveOpen={() => setArchivedOpen(true)}
        onTrashOpen={() => setTrashOpen(true)}
        onJoinOpen={() => setJoinOpen(true)}
        onFeedbackOpen={feedbackEnabled ? () => setFeedbackOpen(true) : null}
        onWhatsNewOpen={openWhatsNew}
        unseenRelease={releaseUnseen}
      />
      {newVersion && <NewVersionBanner />}
      {!hasWorkingChannel && <NoChannelBanner onSetUp={() => setSettingsTab("notifications")} />}
      <DeliveryFailureBanner failures={failures} onFix={() => setSettingsTab("notifications")} />
      <TimezoneMoveBanner />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      <SettingsSheet
        open={settingsTab !== null}
        initialTab={settingsTab ?? "appearance"}
        onClose={() => setSettingsTab(null)}
      />
      <ArchivedBucketsSheet open={archivedOpen} onClose={() => setArchivedOpen(false)} />
      <TrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
      <JoinBucketDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <WhatsNewDialog open={whatsNewOpen} onClose={() => setWhatsNewOpen(false)} />
      <SearchDrawer />
      <AssistantNameProvider name={assistantName}>
        <CapyChat />
      </AssistantNameProvider>
    </>
  );
}
