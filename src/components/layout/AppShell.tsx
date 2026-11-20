"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Header } from "./Header";
import type { SettingsTab } from "./SettingsSheet";
import { DeliveryFailureBanner } from "./DeliveryFailureBanner";
import { PurchaseReturn } from "./PurchaseReturn";
import { NoChannelBanner } from "./NoChannelBanner";
import { SearchDrawer } from "@/components/search/SearchDrawer";
import { useUIStore } from "@/store/ui";
import { useChatStore } from "@/store/chat";
import { useDraftStore } from "@/store/drafts";
import { useTimezoneStore } from "@/store/timezone";
import { TimezoneMoveBanner } from "./TimezoneMoveBanner";
import { BannersProvider } from "./Banners";
import { NewVersionBanner } from "./NewVersionBanner";
import { markReleasesSeenAction } from "@/app/(app)/account-actions";
import { markGuideSeenAction } from "@/app/(app)/guide-actions";
import { lookPickedAction, saveTimezoneIfDefaultAction } from "@/app/(app)/user-settings-actions";
import { useServerEvents } from "@/hooks/useServerEvents";
import { useKeybinds } from "@/hooks/useKeybinds";
import { keybindActions } from "./keybind-actions";
import { PrefixIndicator } from "./PrefixIndicator";
import { FocusExit } from "./FocusExit";
import { CheatSheet } from "./CheatSheet";
import { KeybindsProvider } from "@/components/providers/KeybindsProvider";
import type { StoredKeybinds } from "@/lib/keybinds/schema";
import { useChatDocked } from "@/components/capy/useChatDocked";
import { cn } from "@/lib/utils";
import type { ChannelFailure } from "@/lib/notifications/failures";
import { NOTIFY_STAY } from "@/components/ui/constants";
import { OnceOpen } from "@/components/ui/OnceOpen";
import { notify } from "@/components/ui/notify";
import { HINT_TARGETS } from "@/components/guide/constants";
import { useGuide } from "@/components/guide/useGuide";
import { useTickWhenOpen } from "@/components/guide/useTickWhenOpen";
import { useLayoutStore } from "@/store/layout";
import type { GuideState, GuideTask } from "@/lib/guide/guide";

const CapyChat = dynamic(() => import("@/components/capy/CapyChat").then((m) => m.CapyChat), {
  ssr: false,
});
const SettingsSheet = dynamic(() => import("./SettingsSheet").then((m) => m.SettingsSheet), {
  ssr: false,
});
const ArchivedBucketsSheet = dynamic(
  () => import("@/components/buckets/ArchivedBucketsSheet").then((m) => m.ArchivedBucketsSheet),
  { ssr: false }
);
const TrashSheet = dynamic(
  () => import("@/components/buckets/TrashSheet").then((m) => m.TrashSheet),
  { ssr: false }
);
const JoinBucketDialog = dynamic(
  () => import("@/components/buckets/JoinBucketDialog").then((m) => m.JoinBucketDialog),
  { ssr: false }
);
const FeedbackDialog = dynamic(() => import("./FeedbackDialog").then((m) => m.FeedbackDialog), {
  ssr: false,
});
const WhatsNewDialog = dynamic(() => import("./WhatsNewDialog").then((m) => m.WhatsNewDialog), {
  ssr: false,
});
const LookPickerDialog = dynamic(
  () => import("./LookPickerDialog").then((m) => m.LookPickerDialog),
  { ssr: false }
);
const GuidePanel = dynamic(
  () => import("@/components/guide/GuidePanel").then((m) => m.GuidePanel),
  {
    ssr: false,
  }
);

type AppShellProps = {
  children: ReactNode;
  email: string;
  userId: number;
  avatar: string | null;
  failures: ChannelFailure[];
  hasWorkingChannel: boolean;
  feedbackEnabled: boolean;
  unseenRelease: boolean;
  lookPicked: boolean;
  guide: GuideState;
  appUrl: string | null;
  keybinds: StoredKeybinds;
};

export function AppShell({
  children,
  email,
  userId,
  avatar,
  failures,
  hasWorkingChannel,
  feedbackEnabled,
  unseenRelease,
  lookPicked,
  guide: guideFromServer,
  appUrl,
  keybinds,
}: AppShellProps) {
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");
  const listed = useUIStore((s) => s.itemsLoaded > 0);
  const joinOpen = useUIStore((s) => s.joinOpen);
  const setJoinOpen = useUIStore((s) => s.setJoinOpen);
  const sidePanel = useLayoutStore((s) => s.sidePanel);
  const openSidePanel = useLayoutStore((s) => s.openSidePanel);
  const closeSidePanel = useLayoutStore((s) => s.closeSidePanel);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [releaseUnseen, setReleaseUnseen] = useState(unseenRelease);
  const [pickingLook, setPickingLook] = useState(!lookPicked);
  const { guide, refresh: refreshGuide, setHidden: setGuideHidden } = useGuide(guideFromServer);
  const guideDone = guide.tasks.filter((task) => task.done).length;
  const cheatSheetOpen = useLayoutStore((s) => s.cheatSheetOpen);
  useTickWhenOpen(guide, "open_tweaks", sidePanel === "tweaks");
  useTickWhenOpen(guide, "keyboard_shortcuts", cheatSheetOpen);
  const requestAddItem = useUIStore((s) => s.requestAddItem);
  const openCreateBucket = useUIStore((s) => s.openCreateBucket);
  const requestMembers = useUIStore((s) => s.requestMembers);
  const setChatState = useLayoutStore((s) => s.setChatState);
  const { canDock, docked: chatDocked } = useChatDocked();
  const focusMode = useUIStore((s) => s.focusMode);
  const sideColumn = !focusMode && (chatDocked || (canDock && sidePanel !== null));

  useEffect(() => {
    if (focusMode) setChatState("closed");
  }, [focusMode, setChatState]);

  function openSettings(tab: SettingsTab) {
    setSettingsTab(tab);
    openSidePanel("tweaks");
  }

  const keybindHandlers = keybindActions({
    canDock,
    openTweaks: () => openSettings("appearance"),
  });
  useKeybinds(keybinds, keybindHandlers.onAction, keybindHandlers.onEscape);

  function openGuide() {
    openSidePanel("guide");
    void refreshGuide();
  }

  const hintToast = useRef<string | number>(undefined);

  function showHint(task: GuideTask) {
    closeSidePanel("guide");
    const target = HINT_TARGETS[task.key];
    if (target.kind === "settings") openSettings(target.tab);
    if (target.kind === "add-item") requestAddItem();
    if (target.kind === "new-bucket") openCreateBucket();
    if (target.kind === "bucket-members") requestMembers();
    if (target.kind === "chat") setChatState("open");
    if (hintToast.current !== undefined) notify.dismiss(hintToast.current);
    hintToast.current = notify.info(task.hint, { icon: "map", duration: NOTIFY_STAY });
  }

  function closeLookPicker() {
    setPickingLook(false);
    void lookPickedAction();
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
    if (guideFromServer.seen || pickingLook) return;
    openSidePanel("guide");
    void markGuideSeenAction();
  }, [guideFromServer.seen, pickingLook, openSidePanel]);

  useEffect(() => {
    void useUIStore.persist.rehydrate();
    void useChatStore.persist.rehydrate();
    void useDraftStore.persist.rehydrate();
    void useTimezoneStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (listed) void saveTimezoneIfDefaultAction(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, [listed]);

  return (
    <KeybindsProvider keybinds={keybinds}>
      <PurchaseReturn onPaid={() => openSettings("credits")} />
      <div
        data-side-column={sideColumn || undefined}
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-[padding] duration-200 ease-out",
          sideColumn && "pr-[calc(var(--spacing-chat)+var(--dock-inset))]"
        )}
      >
        {!focusMode && (
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
        )}
        <main className="max-md:scrollbar-hide relative flex flex-1 flex-col overflow-y-auto">
          <BannersProvider banners={banners}>{children}</BannersProvider>
        </main>
      </div>
      <OnceOpen open={sidePanel === "tweaks"}>
        <SettingsSheet
          open={sidePanel === "tweaks"}
          initialTab={settingsTab}
          onClose={() => closeSidePanel("tweaks")}
        />
      </OnceOpen>
      <OnceOpen open={sidePanel === "archive"}>
        <ArchivedBucketsSheet
          open={sidePanel === "archive"}
          onClose={() => closeSidePanel("archive")}
        />
      </OnceOpen>
      <OnceOpen open={sidePanel === "trash"}>
        <TrashSheet open={sidePanel === "trash"} onClose={() => closeSidePanel("trash")} />
      </OnceOpen>
      <OnceOpen open={joinOpen}>
        <JoinBucketDialog open={joinOpen} onClose={() => setJoinOpen(false)} />
      </OnceOpen>
      <OnceOpen open={feedbackOpen}>
        <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      </OnceOpen>
      <OnceOpen open={sidePanel === "whats-new"}>
        <WhatsNewDialog
          open={sidePanel === "whats-new"}
          onClose={() => closeSidePanel("whats-new")}
          onShowGuide={openGuide}
        />
      </OnceOpen>
      <OnceOpen open={pickingLook}>
        <LookPickerDialog open={pickingLook} onClose={closeLookPicker} />
      </OnceOpen>
      <OnceOpen open={sidePanel === "guide"}>
        <GuidePanel
          open={sidePanel === "guide"}
          guide={guide}
          onClose={() => closeSidePanel("guide")}
          onHint={showHint}
          onHiddenChange={setGuideHidden}
        />
      </OnceOpen>
      <SearchDrawer />
      <CheatSheet />
      <PrefixIndicator />
      {focusMode ? <FocusExit /> : <CapyChat appUrl={appUrl} />}
    </KeybindsProvider>
  );
}
