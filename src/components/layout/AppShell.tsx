"use client";

import { useState, type ReactNode } from "react";
import { Header } from "./Header";
import { SettingsSheet } from "./SettingsSheet";

export function AppShell({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <Header onSettingsOpen={() => setSettingsOpen(true)} />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
