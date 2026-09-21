"use client";

import { useState, type ReactNode } from "react";
import { Header } from "./Header";
import { SettingsSheet } from "./SettingsSheet";
import { ArchivedBucketsSheet } from "@/components/buckets/ArchivedBucketsSheet";
import { TrashSheet } from "@/components/buckets/TrashSheet";
import { CapyChat } from "@/components/capy/CapyChat";

export function AppShell({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

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
