"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { Header } from "./Header";
import { SettingsSheet } from "./SettingsSheet";
import { ArchivedBucketsSheet } from "@/components/buckets/ArchivedBucketsSheet";
import { TrashSheet } from "@/components/buckets/TrashSheet";
import { getItemStatusesAction } from "@/app/(app)/actions";
import { useUIStore } from "@/store/ui";
import { useChatStore } from "@/store/chat";
import { useServerEvents } from "@/hooks/useServerEvents";

const CapyChat = dynamic(() => import("@/components/capy/CapyChat").then((m) => m.CapyChat), {
  ssr: false,
});

export function AppShell({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const setStatuses = useUIStore((s) => s.setStatuses);

  useServerEvents();

  useEffect(() => {
    void useUIStore.persist.rehydrate();
    void useChatStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    void getItemStatusesAction().then((r) => {
      if (r.ok) setStatuses(r.statuses);
    });
  }, [setStatuses]);

  return (
    <>
      <Header
        onSettingsOpen={() => setSettingsOpen(true)}
        onArchiveOpen={() => setArchivedOpen(true)}
        onTrashOpen={() => setTrashOpen(true)}
      />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ArchivedBucketsSheet open={archivedOpen} onClose={() => setArchivedOpen(false)} />
      <TrashSheet open={trashOpen} onClose={() => setTrashOpen(false)} />
      <CapyChat />
    </>
  );
}
