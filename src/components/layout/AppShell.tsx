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
import { markGuideSeenAction } from "@/app/(app)/guide-actions";
import { saveTimezoneIfDefaultAction } from "@/app/(app)/user-settings-actions";
import { useServerEvents } from "@/hooks/useServerEvents";
import { AssistantNameProvider } from "@/components/capy/assistant-name";
import type { ChannelFailure } from "@/lib/notifications/failures";
import { toast } from "sonner";
import { GuidePanel } from "@/components/guide/GuidePanel";
import { HINT_TARGETS } from "@/components/guide/constants";
import { useGuide } from "@/components/guide/useGuide";
import { useLayoutStore } from "@/store/layout";
import type { GuideState, GuideTask } from "@/lib/guide/guide";

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
  guide: GuideState;
  appUrl: string | null;
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
  guide: guideFromServer,
  appUrl,
}: AppShellProps) {
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const sheet = useUIStore((s) => s.sheet);
  const openSheet = useUIStore((s) => s.openSheet);
  const closeSheet = useUIStore((s) => s.closeSheet);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [releaseUnseen, setReleaseUnseen] = useState(unseenRelease);
  const [guideOpen, setGuideOpen] = useState(!guideFromServer.seen);
  const { guide, refresh: refreshGuide, setHidden: setGuideHidden } = useGuide(guideFromServer);
  const guideDone = guide.tasks.filter((task) => task.done).length;
  const requestAddItem = useUIStore((s) => s.requestAddItem);
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);
  const requestMembers = useUIStore((s) => s.requestMembers);
  const setChatState = useLayoutStore((s) => s.setChatState);

  function openGuide() {
    setGuideOpen(true);
    void refreshGuide();
  }

  function showHint(task: GuideTask) {
    setGuideOpen(false);
    const target = HINT_TARGETS[task.key];
    if (target.kind === "settings") setSettingsTab(target.tab);
    if (target.kind === "add-item") requestAddItem();
    if (target.kind === "new-bucket") openCreateBucket();
    if (target.kind === "bucket-members") requestMembers();
    if (target.kind === "chat") setChatState("open");
    toast(task.hint);
  }

  function openWhatsNew() {
    setWhatsNewOpen(true);
    if (!releaseUnseen) return;
    setReleaseUnseen(false);
    void markReleasesSeenAction();
  }

  const newVersion = useServerEvents();

  useEffect(() => {
    if (!guideFromServer.seen) void markGuideSeenAction();
  }, [guideFromServer.seen]);

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
        onArchiveOpen={() => openSheet("archive")}
        onTrashOpen={() => openSheet("trash")}
        onJoinOpen={() => openSheet("join")}
        onFeedbackOpen={feedbackEnabled ? () => setFeedbackOpen(true) : null}
        onWhatsNewOpen={openWhatsNew}
        unseenRelease={releaseUnseen}
        onGuideOpen={openGuide}
        guideProgress={`${guideDone}/${guide.tasks.length}`}
        guideUnfinished={guideDone < guide.tasks.length && !guide.hidden}
      />
      <div className="mx-auto w-full max-w-6xl">
        {newVersion && <NewVersionBanner />}
        {!hasWorkingChannel && <NoChannelBanner onSetUp={() => setSettingsTab("notifications")} />}
        <DeliveryFailureBanner failures={failures} onFix={() => setSettingsTab("notifications")} />
        <TimezoneMoveBanner />
      </div>
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      <SettingsSheet
        open={settingsTab !== null}
        initialTab={settingsTab ?? "appearance"}
        onClose={() => setSettingsTab(null)}
      />
      <ArchivedBucketsSheet open={sheet === "archive"} onClose={closeSheet} />
      <TrashSheet open={sheet === "trash"} onClose={closeSheet} />
      <JoinBucketDialog open={sheet === "join"} onClose={closeSheet} />
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <WhatsNewDialog
        open={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
        onShowGuide={() => {
          setWhatsNewOpen(false);
          openGuide();
        }}
      />
      <GuidePanel
        open={guideOpen}
        guide={guide}
        onClose={() => setGuideOpen(false)}
        onHint={showHint}
        onHiddenChange={setGuideHidden}
      />
      <SearchDrawer />
      <AssistantNameProvider name={assistantName}>
        <CapyChat appUrl={appUrl} />
      </AssistantNameProvider>
    </>
  );
}
