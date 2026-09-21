"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Header } from "./Header";
import { SettingsSheet } from "./SettingsSheet";
import { ArchivedBucketsSheet } from "@/components/buckets/ArchivedBucketsSheet";
import { TrashSheet } from "@/components/buckets/TrashSheet";
import { CapyChat } from "@/components/capy/CapyChat";
import { getItemStatusesAction } from "@/app/(app)/actions";
import { useUIStore } from "@/store/ui";

export function AppShell({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const setStatuses = useUIStore((s) => s.setStatuses);

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
