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
import { useDraftStore } from "@/store/drafts";
import { useTimezoneStore } from "@/store/timezone";
import { TimezoneMoveBanner } from "./TimezoneMoveBanner";
import { BannersProvider } from "./Banners";
import { NewVersionBanner } from "./NewVersionBanner";
import { FeedbackDialog } from "./FeedbackDialog";
import { WhatsNewDialog } from "./WhatsNewDialog";
import { markReleasesSeenAction } from "@/app/(app)/account-actions";
import { markGuideSeenAction } from "@/app/(app)/guide-actions";
import { saveTimezoneIfDefaultAction } from "@/app/(app)/user-settings-actions";
import { useServerEvents } from "@/hooks/useServerEvents";
import { AssistantNameProvider } from "@/components/capy/assistant-name";
import { useChatDocked } from "@/components/capy/useChatDocked";
import { cn } from "@/lib/utils";
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
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");
  const joinOpen = useUIStore((s) => s.joinOpen);
  const setJoinOpen = useUIStore((s) => s.setJoinOpen);
  const sidePanel = useLayoutStore((s) => s.sidePanel);
  const openSidePanel = useLayoutStore((s) => s.openSidePanel);
  const closeSidePanel = useLayoutStore((s) => s.closeSidePanel);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [releaseUnseen, setReleaseUnseen] = useState(unseenRelease);
  const { guide, refresh: refreshGuide, setHidden: setGuideHidden } = useGuide(guideFromServer);
  const guideDone = guide.tasks.filter((task) => task.done).length;
  const requestAddItem = useUIStore((s) => s.requestAddItem);
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);
  const requestMembers = useUIStore((s) => s.requestMembers);
  const setChatState = useLayoutStore((s) => s.setChatState);
  const { canDock, docked: chatDocked } = useChatDocked();
  const sideColumn = chatDocked || (canDock && sidePanel !== null);

  function openSettings(tab: SettingsTab) {
    setSettingsTab(tab);
    openSidePanel("tweaks");
  }

  function openGuide() {
    openSidePanel("guide");
    void refreshGuide();
  }

  function showHint(task: GuideTask) {
    closeSidePanel("guide");
    const target = HINT_TARGETS[task.key];
    if (target.kind === "settings") openSettings(target.tab);
    if (target.kind === "add-item") requestAddItem(target.form);
    if (target.kind === "new-bucket") openCreateBucket();
    if (target.kind === "bucket-members") requestMembers();
    if (target.kind === "chat") setChatState("open");
    toast(task.hint);
  }

  function openWhatsNew() {
    openSidePanel("whats-new");
    if (!releaseUnseen) return;
    setReleaseUnseen(false);
    void markReleasesSeenAction();
  }

  const newVersion = useServerEvents();
  const banners = (
    <div className="max-w-column mx-auto w-full">
      {newVersion && <NewVersionBanner />}
      {!hasWorkingChannel && <NoChannelBanner onSetUp={() => openSettings("notifications")} />}
      <DeliveryFailureBanner failures={failures} onFix={() => openSettings("notifications")} />
      <TimezoneMoveBanner />
    </div>
  );

  useEffect(() => {
    if (guideFromServer.seen) return;
    openSidePanel("guide");
    void markGuideSeenAction();
  }, [guideFromServer.seen, openSidePanel]);

  useEffect(() => {
    void useUIStore.persist.rehydrate();
    void useChatStore.persist.rehydrate();
    void useDraftStore.persist.rehydrate();
    void useTimezoneStore.persist.rehydrate();
    void saveTimezoneIfDefaultAction(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  return (
    <AssistantNameProvider name={assistantName}>
      <PurchaseReturn onPaid={() => openSettings("credits")} />
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-[padding] duration-200 ease-out",
          sideColumn && "pr-[calc(var(--spacing-chat)+var(--dock-inset))]"
        )}
      >
        <Header
          email={email}
          userId={userId}
          avatar={avatar}
          onSettingsOpen={() => openSettings("appearance")}
          onArchiveOpen={() => openSidePanel("archive")}
          onTrashOpen={() => openSidePanel("trash")}
          onJoinOpen={() => setJoinOpen(true)}
          onFeedbackOpen={feedbackEnabled ? () => setFeedbackOpen(true) : null}
          onWhatsNewOpen={openWhatsNew}
          unseenRelease={releaseUnseen}
          onGuideOpen={openGuide}
          guideProgress={`${guideDone}/${guide.tasks.length}`}
          guideUnfinished={guideDone < guide.tasks.length && !guide.hidden}
        />
        <main className="max-md:scrollbar-hide flex flex-1 flex-col overflow-y-auto">
          <BannersProvider banners={banners}>{children}</BannersProvider>
        </main>
      </div>
      <SettingsSheet
        open={sidePanel === "tweaks"}
        initialTab={settingsTab}
        onClose={() => closeSidePanel("tweaks")}
      />
      <ArchivedBucketsSheet
        open={sidePanel === "archive"}
        onClose={() => closeSidePanel("archive")}
      />
      <TrashSheet open={sidePanel === "trash"} onClose={() => closeSidePanel("trash")} />
      <JoinBucketDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <WhatsNewDialog
        open={sidePanel === "whats-new"}
        onClose={() => closeSidePanel("whats-new")}
        onShowGuide={openGuide}
      />
      <GuidePanel
        open={sidePanel === "guide"}
        guide={guide}
        onClose={() => closeSidePanel("guide")}
        onHint={showHint}
        onHiddenChange={setGuideHidden}
      />
      <SearchDrawer />
      <CapyChat appUrl={appUrl} />
    </AssistantNameProvider>
  );
}
